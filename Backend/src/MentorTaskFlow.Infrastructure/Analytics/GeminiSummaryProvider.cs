using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Infrastructure.Observability;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Analytics;

/// <summary>
/// The Google Gemini implementation of <see cref="IAiSummaryProvider"/> (<c>AI-001</c>).
/// </summary>
/// <remarks>
/// <para>
/// Plain REST rather than an SDK: one endpoint, one request shape, and the retry and time budget of
/// <c>AI-003</c> stay entirely in this class, as they do for <see cref="AnthropicSummaryProvider"/>.
/// </para>
/// <para>
/// Two things differ from the Anthropic provider. Thinking cannot be switched off on the current
/// flash models, only lowered, and its tokens count against the output cap — hence
/// <see cref="AiOptions.ThinkingLevel"/> and the larger <see cref="AiOptions.MaxOutputTokens"/>. And
/// quotas and capacity are per model, so an overloaded, exhausted or silent model hands over at once to
/// the next one of <see cref="AiOptions.ModelChain"/>; only when every model has failed does it wait.
/// </para>
/// </remarks>
public sealed class GeminiSummaryProvider(
    IHttpClientFactory httpClientFactory,
    IOptions<AiOptions> options,
    AiRequestLimiter limiter,
    AiMetrics metrics,
    AiProviderStatus status,
    IClock clock,
    ILogger<GeminiSummaryProvider> logger) : IAiSummaryProvider
{
    public const string HttpClientName = "gemini";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly AiOptions _options = options.Value;

    public string ModelId => _options.ModelId;

    public string PromptVersion => _options.PromptVersion;

    public bool IsConfigured => _options.IsConfigured;

    public async Task<AiSummaryCompletion> GenerateAsync(
        AiSummaryPrompt prompt,
        CancellationToken cancellationToken)
    {
        var budget = TimeSpan.FromSeconds(_options.TotalBudgetSeconds);
        var elapsed = Stopwatch.StartNew();

        using var budgetSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        budgetSource.CancelAfter(budget);

        var chain = _options.ModelChain();
        var retired = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;
        var attempts = 0;

        for (var round = 0; ; )
        {
            var model = chain[index];
            attempts++;

            try
            {
                await AcquireSlotAsync(elapsed, budget, budgetSource.Token);

                var completion = await CallAsync(model, prompt, budgetSource.Token);

                status.RecordSuccess();
                metrics.Tokens(model, completion.InputTokens, completion.OutputTokens);

                return completion;
            }
            catch (GeminiApiException exception)
                when (exception.StatusCode == HttpStatusCode.NotFound && Next(chain, index, retired) is { } next)
            {
                // The model was retired — Google withdraws flash versions for new keys with little
                // notice. The next one keeps reports working until the setting is updated.
                logger.LogError("Gemini model {Model} is not available; switching to {Next}.", model, chain[next]);
                retired.Add(model);
                index = next;
            }
            catch (Exception exception) when (IsRetryable(exception, cancellationToken))
            {
                if (elapsed.Elapsed >= budget)
                {
                    throw Unavailable(exception, attempts);
                }

                // Overloaded, out of quota or silent: the next model has its own capacity and
                // allowance, so it is asked at once rather than after a pause.
                if (Next(chain, index, retired) is { } next)
                {
                    logger.LogWarning(exception, "Gemini model {Model} failed; trying {Next}.", model, chain[next]);
                    index = next;
                    continue;
                }

                // Every model failed: wait, then go through them again from the start.
                var delay = AiOptions.RetryDelays[Math.Min(round, AiOptions.RetryDelays.Count - 1)];

                if (round >= _options.MaxRetries || elapsed.Elapsed + delay >= budget)
                {
                    throw Unavailable(exception, attempts);
                }

                round++;
                index = chain.Select((name, i) => (name, i)).First(m => !retired.Contains(m.name)).i;

                logger.LogWarning(
                    exception,
                    "Every Gemini model failed; round {Round} on {Model} in {Delay}.",
                    round + 1,
                    chain[index],
                    delay);

                await Task.Delay(delay, budgetSource.Token);
            }
            catch (Exception exception) when (exception is not AppException and not OperationCanceledException)
            {
                // A permanent error — a malformed request, a rejected key, a blocked prompt. Retrying
                // cannot change the answer (AI-003).
                throw Unavailable(exception, attempts);
            }
        }
    }

    /// <summary>The next model of the chain after <paramref name="index"/> that has not been retired, or null.</summary>
    private static int? Next(IReadOnlyList<string> chain, int index, HashSet<string> retired)
    {
        for (var i = index + 1; i < chain.Count; i++)
        {
            if (!retired.Contains(chain[i]))
            {
                return i;
            }
        }

        return null;
    }

    /// <summary>
    /// Waits for the installation's own rate limit, within the budget.
    /// </summary>
    /// <remarks>
    /// Refusals are 429 with a wait the user can act on, never 503: nothing is broken, and
    /// <see cref="AiProviderStatus"/> must not report an outage because people clicked quickly.
    /// </remarks>
    private async Task AcquireSlotAsync(Stopwatch elapsed, TimeSpan budget, CancellationToken cancellationToken)
    {
        while (true)
        {
            var decision = limiter.TryAcquire();

            if (decision.IsAcquired)
            {
                return;
            }

            if (decision.IsDayExhausted)
            {
                metrics.Failure("DailyLimit");
                throw new TooManyRequestsException(
                    "Дневной лимит ИИ-отчётов исчерпан. Цифры отчёта доступны и без резюме — попробуйте завтра.");
            }

            // A short queue is better than a refusal; a long one is not — a person is waiting.
            if (decision.RetryAfter > TimeSpan.FromSeconds(20) || elapsed.Elapsed + decision.RetryAfter >= budget)
            {
                metrics.Failure("MinuteLimit");
                throw new TooManyRequestsException(
                    $"Слишком много ИИ-запросов подряд. Повторите через {Math.Ceiling(decision.RetryAfter.TotalSeconds)} с.");
            }

            await Task.Delay(decision.RetryAfter, cancellationToken);
        }
    }

    private async Task<AiSummaryCompletion> CallAsync(
        string model,
        AiSummaryPrompt prompt,
        CancellationToken cancellationToken)
    {
        using var attemptSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        attemptSource.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

        var client = httpClientFactory.CreateClient(HttpClientName);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"models/{Uri.EscapeDataString(model)}:generateContent");

        // A header, not the ?key= query parameter: URLs end up in proxy and access logs.
        request.Headers.Add("x-goog-api-key", _options.ApiKey);
        request.Content = JsonContent.Create(Body(prompt), options: Json);

        using var response = await client.SendAsync(request, attemptSource.Token);

        if (!response.IsSuccessStatusCode)
        {
            throw await GeminiApiException.FromAsync(response, attemptSource.Token);
        }

        var payload = await response.Content.ReadFromJsonAsync<GenerateContentResponse>(Json, attemptSource.Token)
            ?? throw new InvalidOperationException("Gemini вернул пустое тело ответа.");

        var candidate = payload.Candidates?.FirstOrDefault();

        if (candidate is null)
        {
            throw new InvalidOperationException(
                $"Gemini не вернул ответа (blockReason={payload.PromptFeedback?.BlockReason ?? "нет"}).");
        }

        // Thought summaries are reasoning, not the report; they arrive as parts flagged "thought".
        var content = string.Concat(
            (candidate.Content?.Parts ?? [])
                .Where(part => part.Thought != true)
                .Select(part => part.Text));

        if (candidate.FinishReason is "MAX_TOKENS")
        {
            // A report cut off mid-sentence is worse than none, and would be cached for the period.
            throw new InvalidOperationException(
                "Ответ Gemini обрезан по лимиту токенов — увеличьте Ai__MaxOutputTokens.");
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            throw new InvalidOperationException(
                $"Gemini вернул пустой ответ (finishReason={candidate.FinishReason}).");
        }

        var usage = payload.UsageMetadata;

        return new AiSummaryCompletion(
            content.Trim(),
            usage?.PromptTokenCount,

            // Thinking is billed as output, so it is counted as output.
            usage is null ? null : (usage.CandidatesTokenCount ?? 0) + (usage.ThoughtsTokenCount ?? 0),
            payload.ResponseId,
            string.Equals(model, _options.ModelId, StringComparison.Ordinal) ? null : model);
    }

    private JsonObject Body(AiSummaryPrompt prompt)
    {
        var generationConfig = new JsonObject
        {
            ["maxOutputTokens"] = _options.MaxOutputTokens,

            // Low: the model describes figures it was given and should not get inventive about them.
            ["temperature"] = 0.3,
            ["thinkingConfig"] = new JsonObject { ["thinkingLevel"] = _options.ThinkingLevel },
        };

        if (prompt.JsonSchema is { } schema)
        {
            generationConfig["responseMimeType"] = "application/json";
            generationConfig["responseJsonSchema"] = JsonNode.Parse(schema);
        }

        return new JsonObject
        {
            // The rules and the data stay in separate blocks — the AI-015 boundary.
            ["systemInstruction"] = new JsonObject
            {
                ["parts"] = new JsonArray(new JsonObject { ["text"] = prompt.SystemInstructions }),
            },
            ["contents"] = new JsonArray(new JsonObject
            {
                ["role"] = "user",
                ["parts"] = new JsonArray(new JsonObject { ["text"] = prompt.Data }),
            }),
            ["generationConfig"] = generationConfig,
        };
    }

    private static bool IsRetryable(Exception exception, CancellationToken callerToken) =>
        !callerToken.IsCancellationRequested
        && exception is GeminiApiException { IsTransient: true }
            or HttpRequestException
            or IOException
            or TaskCanceledException
            or TimeoutException;

    private ServiceUnavailableException Unavailable(Exception exception, int attempts)
    {
        status.RecordFailure(clock.UtcNow);
        metrics.Failure(exception is GeminiApiException api ? $"Gemini{(int)api.StatusCode}" : exception.GetType().Name);

        logger.LogError(exception, "AI provider gave up after {Attempts} attempt(s).", attempts);

        // The provider's own message never reaches the caller (AUD-022, SEC-021).
        return new ServiceUnavailableException(
            ErrorCodes.AiProviderUnavailable,
            "AI-провайдер сейчас недоступен. Метрики отчёта доступны без резюме.");
    }

    private sealed record GenerateContentResponse(
        IReadOnlyList<Candidate>? Candidates,
        PromptFeedback? PromptFeedback,
        UsageMetadata? UsageMetadata,
        string? ResponseId);

    private sealed record Candidate(CandidateContent? Content, string? FinishReason);

    private sealed record CandidateContent(IReadOnlyList<Part>? Parts);

    private sealed record Part(string? Text, bool? Thought);

    private sealed record PromptFeedback(string? BlockReason);

    private sealed record UsageMetadata(int? PromptTokenCount, int? CandidatesTokenCount, int? ThoughtsTokenCount);
}

/// <summary>A non-success answer from the Gemini API.</summary>
/// <remarks>
/// Carries Google's status name (<c>RESOURCE_EXHAUSTED</c>, <c>UNAVAILABLE</c>…) for the log. The
/// message is truncated: it is logged, never returned to the caller.
/// </remarks>
public sealed class GeminiApiException(HttpStatusCode statusCode, string? status, string? detail)
    : Exception($"Gemini API {(int)statusCode} {status}: {detail}")
{
    public HttpStatusCode StatusCode { get; } = statusCode;

    /// <summary>429 and 5xx — worth another attempt (<c>AI-003</c>).</summary>
    public bool IsTransient => StatusCode == HttpStatusCode.TooManyRequests || (int)StatusCode >= 500;

    /// <summary>Overloaded or out of quota — worth another attempt on a different model.</summary>
    public bool IsCapacity =>
        StatusCode is HttpStatusCode.TooManyRequests or HttpStatusCode.ServiceUnavailable;

    public static async Task<GeminiApiException> FromAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        string? status = null;
        string? message = null;

        try
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var error = JsonNode.Parse(body)?["error"];

            status = error?["status"]?.GetValue<string>();
            message = error?["message"]?.GetValue<string>();
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or FormatException)
        {
            // Not JSON — a proxy's error page. The status code alone decides what happens next.
        }

        if (message is { Length: > 300 })
        {
            message = message[..300] + "…";
        }

        return new GeminiApiException(response.StatusCode, status, message);
    }
}

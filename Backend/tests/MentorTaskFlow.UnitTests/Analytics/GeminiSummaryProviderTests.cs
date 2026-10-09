using System.Diagnostics.Metrics;
using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Infrastructure.Analytics;
using MentorTaskFlow.Infrastructure.Observability;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace MentorTaskFlow.UnitTests.Analytics;

/// <summary>The Gemini REST provider against a scripted fake of the API (AI-001, AI-003).</summary>
public sealed class GeminiSummaryProviderTests
{
    private const string Primary = "gemini-3.8-flash";
    private const string Fallback = "gemini-3.5-flash";

    private static readonly AiSummaryPrompt Prompt = new("Правила.", "<untrusted_data>данные</untrusted_data>");

    [Fact]
    public async Task Sends_the_key_in_a_header_and_returns_the_answer_without_thoughts()
    {
        var api = new FakeGemini(_ => Ok(
            """
            {
              "candidates": [{ "content": { "parts": [
                { "text": "размышления", "thought": true },
                { "text": "Итог недели." }
              ] }, "finishReason": "STOP" }],
              "usageMetadata": { "promptTokenCount": 120, "candidatesTokenCount": 40, "thoughtsTokenCount": 200 },
              "responseId": "resp-1"
            }
            """));

        var completion = await Provider(api).GenerateAsync(Prompt, CancellationToken.None);

        completion.Content.ShouldBe("Итог недели.");
        completion.InputTokens.ShouldBe(120);
        completion.OutputTokens.ShouldBe(240);
        completion.RequestId.ShouldBe("resp-1");
        completion.Model.ShouldBeNull();

        var call = api.Calls.ShouldHaveSingleItem();
        call.Path.ShouldBe($"/v1beta/models/{Primary}:generateContent");
        call.ApiKey.ShouldBe("test-key");
        call.Query.ShouldBeEmpty();

        var body = JsonNode.Parse(call.Body)!;
        body["systemInstruction"]!["parts"]![0]!["text"]!.GetValue<string>().ShouldBe("Правила.");
        body["contents"]![0]!["parts"]![0]!["text"]!.GetValue<string>().ShouldContain("untrusted_data");
        body["generationConfig"]!["thinkingConfig"]!["thinkingLevel"]!.GetValue<string>().ShouldBe("low");
        body["generationConfig"]!["responseMimeType"].ShouldBeNull();
    }

    [Fact]
    public async Task Asks_for_json_when_the_prompt_carries_a_schema()
    {
        var api = new FakeGemini(_ => Ok(Answer("{\"summary\":\"ok\"}")));
        var prompt = Prompt with { JsonSchema = """{"type":"object","properties":{"summary":{"type":"string"}}}""" };

        await Provider(api).GenerateAsync(prompt, CancellationToken.None);

        var config = JsonNode.Parse(api.Calls.Single().Body)!["generationConfig"]!;
        config["responseMimeType"]!.GetValue<string>().ShouldBe("application/json");
        config["responseJsonSchema"]!["type"]!.GetValue<string>().ShouldBe("object");
    }

    [Fact]
    public async Task An_overloaded_model_is_retried_on_the_fallback()
    {
        var api = new FakeGemini(call => call.Path.Contains(Primary)
            ? Error(HttpStatusCode.ServiceUnavailable, "UNAVAILABLE")
            : Ok(Answer("С запасной модели.")));

        var completion = await Provider(api).GenerateAsync(Prompt, CancellationToken.None);

        completion.Content.ShouldBe("С запасной модели.");
        completion.Model.ShouldBe(Fallback);
        api.Calls.Select(c => c.Path.Contains(Primary)).ShouldBe([true, false]);
    }

    [Fact]
    public async Task A_retired_model_switches_to_the_fallback_at_once()
    {
        var api = new FakeGemini(call => call.Path.Contains(Primary)
            ? Error(HttpStatusCode.NotFound, "NOT_FOUND")
            : Ok(Answer("Работает.")));

        var completion = await Provider(api).GenerateAsync(Prompt, CancellationToken.None);

        completion.Model.ShouldBe(Fallback);
        api.Calls.Count.ShouldBe(2);
    }

    [Fact]
    public async Task A_rejected_request_is_not_retried()
    {
        var api = new FakeGemini(_ => Error(HttpStatusCode.BadRequest, "INVALID_ARGUMENT"));

        var failure = await Should.ThrowAsync<ServiceUnavailableException>(
            () => Provider(api).GenerateAsync(Prompt, CancellationToken.None));

        failure.Message.ShouldNotContain("INVALID_ARGUMENT");
        api.Calls.Count.ShouldBe(1);
    }

    [Fact]
    public async Task A_truncated_answer_is_a_failure_not_a_report()
    {
        var api = new FakeGemini(_ => Ok(
            """{ "candidates": [{ "content": { "parts": [{ "text": "Начало отчёта" }] }, "finishReason": "MAX_TOKENS" }] }"""));

        await Should.ThrowAsync<ServiceUnavailableException>(
            () => Provider(api).GenerateAsync(Prompt, CancellationToken.None));
    }

    [Fact]
    public async Task The_daily_ceiling_refuses_without_calling_the_api()
    {
        var api = new FakeGemini(_ => Ok(Answer("Первый.")));
        var options = new AiOptions { Enabled = true, ApiKey = "test-key", MaxRequestsPerDay = 1 };
        var limiter = new AiRequestLimiter(Microsoft.Extensions.Options.Options.Create(options), new FixedClock());

        await Provider(api, options, limiter).GenerateAsync(Prompt, CancellationToken.None);

        await Should.ThrowAsync<TooManyRequestsException>(
            () => Provider(api, options, limiter).GenerateAsync(Prompt, CancellationToken.None));
        api.Calls.Count.ShouldBe(1);
    }

    [Fact]
    public void The_minute_ceiling_says_when_a_slot_frees_up()
    {
        var clock = new FixedClock();
        var options = new AiOptions { MaxRequestsPerMinute = 2 };
        var limiter = new AiRequestLimiter(Microsoft.Extensions.Options.Options.Create(options), clock);

        limiter.TryAcquire().IsAcquired.ShouldBeTrue();
        clock.Now += TimeSpan.FromSeconds(10);
        limiter.TryAcquire().IsAcquired.ShouldBeTrue();

        var refused = limiter.TryAcquire();
        refused.IsAcquired.ShouldBeFalse();
        refused.RetryAfter.ShouldBe(TimeSpan.FromSeconds(50));

        clock.Now += TimeSpan.FromSeconds(50);
        limiter.TryAcquire().IsAcquired.ShouldBeTrue();
    }

    [Theory]
    [InlineData("Gemini", "gemini-3.8-flash", true)]
    [InlineData("Gemini", "claude-sonnet-5", false)]
    [InlineData("Anthropic", "claude-sonnet-5", true)]
    [InlineData("Anthropic", "gemini-3.8-flash", false)]
    public void A_model_from_the_other_provider_is_caught_at_startup(string provider, string model, bool valid) =>
        new AiOptions { Provider = provider, ModelId = model }.ModelMatchesProvider.ShouldBe(valid);

    private static GeminiSummaryProvider Provider(
        FakeGemini api,
        AiOptions? options = null,
        AiRequestLimiter? limiter = null)
    {
        options ??= new AiOptions
        {
            Enabled = true,
            ApiKey = "test-key",
            ModelId = Primary,
            FallbackModelId = Fallback,
        };

        var wrapped = Microsoft.Extensions.Options.Options.Create(options);
        var meters = new ServiceCollection().AddMetrics().BuildServiceProvider().GetRequiredService<IMeterFactory>();

        return new GeminiSummaryProvider(
            new SingleClientFactory(new HttpClient(api) { BaseAddress = new Uri(options.GeminiBaseUrl) }),
            wrapped,
            limiter ?? new AiRequestLimiter(wrapped, new FixedClock()),
            new AiMetrics(meters),
            new AiProviderStatus(),
            new FixedClock(),
            NullLogger<GeminiSummaryProvider>.Instance);
    }

    private static string Answer(string text) =>
        new JsonObject
        {
            ["candidates"] = new JsonArray(new JsonObject
            {
                ["content"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = text }) },
                ["finishReason"] = "STOP",
            }),
        }.ToJsonString();

    private static HttpResponseMessage Ok(string json) =>
        new(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Error(HttpStatusCode code, string status) =>
        new(code)
        {
            Content = new StringContent(
                $$"""{ "error": { "code": {{(int)code}}, "message": "fake", "status": "{{status}}" } }""",
                Encoding.UTF8,
                "application/json"),
        };

    private sealed record Call(string Path, string Query, string? ApiKey, string Body);

    private sealed class FakeGemini(Func<Call, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<Call> Calls { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var call = new Call(
                request.RequestUri!.AbsolutePath,
                request.RequestUri.Query,
                request.Headers.TryGetValues("x-goog-api-key", out var keys) ? keys.Single() : null,
                await request.Content!.ReadAsStringAsync(cancellationToken));

            Calls.Add(call);

            return respond(call);
        }
    }

    private sealed class SingleClientFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    private sealed class FixedClock : IClock
    {
        public DateTimeOffset Now { get; set; } = new(2026, 10, 9, 9, 0, 0, TimeSpan.Zero);

        public DateTimeOffset UtcNow => Now;
    }
}

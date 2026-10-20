using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <summary>The CRM refused the key — missing, unknown or blocked (real HTTP 401).</summary>
public sealed class CrmUnauthorizedException(string message) : Exception(message);

/// <summary>The CRM could not be reached or kept failing after the retries.</summary>
public sealed class CrmUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>The CRM rejected the request itself — <c>statusCode 400</c> in the body under HTTP 200.</summary>
public sealed class CrmRequestException(string message) : Exception(message);

/// <summary>
/// Read-only client of Omuz CRM <c>integration/v1</c>.
/// </summary>
/// <remarks>
/// <para>
/// The CRM reports two kinds of failure differently, and both are checked: key problems as a real HTTP
/// 401, data problems («group not found», «no timetable», a bad parameter) as HTTP 200 with the code in
/// the body. A «not found» comes back as <c>null</c>; everything else as an exception.
/// </para>
/// <para>
/// One client per process with its own pacing: the CRM sets no per-key limit, so this one keeps a
/// minimum gap between requests. Network failures and 5xx are retried with a short backoff; 4xx are not.
/// </para>
/// </remarks>
public sealed class OmuzCrmClient(
    IHttpClientFactory httpClientFactory,
    IOptions<OmuzCrmOptions> options,
    ILogger<OmuzCrmClient> logger)
{
    public const string HttpClientName = "OmuzCrm";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan[] Backoff = [TimeSpan.FromMilliseconds(500), TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2)];
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static DateTimeOffset _lastRequest = DateTimeOffset.MinValue;

    private readonly OmuzCrmOptions _options = options.Value;

    public bool IsConfigured => _options.IsConfigured;

    public Task<CrmPing?> PingAsync(CancellationToken cancellationToken) =>
        GetAsync<CrmPing>("ping", cancellationToken);

    public async Task<IReadOnlyList<CrmRef>> GetCoursesAsync(CancellationToken cancellationToken) =>
        await GetAsync<List<CrmRef>>("courses", cancellationToken) ?? [];

    public async Task<IReadOnlyList<CrmRef>> GetBranchesAsync(CancellationToken cancellationToken) =>
        await GetAsync<List<CrmRef>>("branches", cancellationToken) ?? [];

    /// <summary>Groups of one status — every page. Without a status the CRM returns only running groups.</summary>
    public Task<IReadOnlyList<CrmGroup>> ListGroupsAsync(int status, CancellationToken cancellationToken) =>
        ListAllAsync<CrmGroup>($"groups?Status={status}", cancellationToken);

    public Task<IReadOnlyList<CrmMentor>> ListMentorsAsync(CancellationToken cancellationToken) =>
        ListAllAsync<CrmMentor>("mentors", cancellationToken);

    /// <summary>The group with every mentor and student it ever had; null when the CRM does not know it.</summary>
    public Task<CrmGroup?> GetGroupAsync(int groupId, CancellationToken cancellationToken) =>
        GetAsync<CrmGroup>($"groups/{groupId}", cancellationToken);

    /// <summary>
    /// The whole journal, newest period first. Null when there is none — the group is unknown or has no
    /// timetable, which the CRM reports the same way.
    /// </summary>
    public Task<List<CrmJournalPeriod>?> GetJournalAsync(int groupId, CancellationToken cancellationToken) =>
        GetAsync<List<CrmJournalPeriod>>($"groups/{groupId}/journal", cancellationToken);

    private async Task<IReadOnlyList<T>> ListAllAsync<T>(string path, CancellationToken cancellationToken)
    {
        var all = new List<T>();
        var separator = path.Contains('?', StringComparison.Ordinal) ? '&' : '?';

        for (var page = 1; ; page++)
        {
            var envelope = await SendAsync<List<T>>($"{path}{separator}PageNumber={page}&PageSize={_options.PageSize}", cancellationToken);
            var items = Unwrap(envelope);
            all.AddRange(items ?? []);

            // Rows are ordered by id, so pages never skip or repeat; stop on the last page or an empty one.
            if (items is null || items.Count == 0 || page >= (envelope.TotalPages ?? 1))
            {
                return all;
            }
        }
    }

    private async Task<T?> GetAsync<T>(string path, CancellationToken cancellationToken) where T : class =>
        Unwrap(await SendAsync<T>(path, cancellationToken));

    private static T? Unwrap<T>(CrmEnvelope<T> envelope) where T : class => envelope.StatusCode switch
    {
        200 => envelope.Data,
        404 => null,
        _ => throw new CrmRequestException(string.Join("; ", envelope.Errors ?? [$"CRM statusCode {envelope.StatusCode}"])),
    };

    private async Task<CrmEnvelope<T>> SendAsync<T>(string path, CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            throw new InvalidOperationException("OmuzCrm:ApiKey is not configured.");
        }

        for (var attempt = 0; ; attempt++)
        {
            await PaceAsync(cancellationToken);

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, path);
                request.Headers.Add("X-Api-Key", _options.ApiKey);

                using var response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, cancellationToken);

                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    var body = await response.Content.ReadFromJsonAsync<CrmEnvelope<object>>(Json, cancellationToken);
                    throw new CrmUnauthorizedException(body?.Errors?.FirstOrDefault() ?? "CRM отклонила API-ключ.");
                }

                if ((int)response.StatusCode >= 500 && attempt < Backoff.Length)
                {
                    logger.LogWarning("CRM {Path} answered {Status}; retrying.", path, (int)response.StatusCode);
                    await Task.Delay(Backoff[attempt], cancellationToken);
                    continue;
                }

                if (!response.IsSuccessStatusCode)
                {
                    throw new CrmUnavailableException($"CRM ответила HTTP {(int)response.StatusCode}.");
                }

                return await response.Content.ReadFromJsonAsync<CrmEnvelope<T>>(Json, cancellationToken)
                       ?? throw new CrmUnavailableException("CRM вернула пустой ответ.");
            }
            catch (Exception exception) when (attempt < Backoff.Length
                                              && !cancellationToken.IsCancellationRequested
                                              && exception is HttpRequestException or TaskCanceledException)
            {
                logger.LogWarning(exception, "CRM {Path} is unreachable; retrying.", path);
                await Task.Delay(Backoff[attempt], cancellationToken);
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested
                                              && exception is HttpRequestException or TaskCanceledException or JsonException)
            {
                throw new CrmUnavailableException("CRM недоступна или ответила в неожиданном формате.", exception);
            }
        }
    }

    private async Task PaceAsync(CancellationToken cancellationToken)
    {
        await Gate.WaitAsync(cancellationToken);
        try
        {
            var wait = _lastRequest + TimeSpan.FromMilliseconds(_options.MinRequestIntervalMs) - DateTimeOffset.UtcNow;
            if (wait > TimeSpan.Zero)
            {
                await Task.Delay(wait, cancellationToken);
            }

            _lastRequest = DateTimeOffset.UtcNow;
        }
        finally
        {
            Gate.Release();
        }
    }
}

using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Analytics;

/// <summary>
/// The installation's own ceiling on calls to the model, below the provider's quota.
/// </summary>
/// <remarks>
/// <para>
/// Free and low-tier Gemini keys are limited per minute and per day. Hitting the provider's limit
/// costs a round trip and answers with a 429 nobody can act on; hitting this one answers at once
/// with "try again in N seconds", and keeps the remaining daily allowance for the reports that
/// matter instead of a burst of retries.
/// </para>
/// <para>
/// In memory and per process: only the API process calls the model, and a restart forgetting the
/// count errs on the side of the provider's own limit, which still applies.
/// </para>
/// </remarks>
public sealed class AiRequestLimiter(IOptions<AiOptions> options, IClock clock)
{
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    private readonly AiOptions _options = options.Value;
    private readonly Queue<DateTimeOffset> _recent = new();
    private readonly Lock _gate = new();

    private DateOnly _day;
    private int _dayCount;

    /// <summary>
    /// Takes a slot, or says how long until one frees up.
    /// </summary>
    public AiQuotaDecision TryAcquire()
    {
        var now = clock.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);

        lock (_gate)
        {
            if (today != _day)
            {
                _day = today;
                _dayCount = 0;
            }

            if (_dayCount >= _options.MaxRequestsPerDay)
            {
                return AiQuotaDecision.DayExhausted;
            }

            while (_recent.Count > 0 && now - _recent.Peek() >= Window)
            {
                _recent.Dequeue();
            }

            if (_recent.Count >= _options.MaxRequestsPerMinute)
            {
                return AiQuotaDecision.WaitFor(_recent.Peek() + Window - now);
            }

            _recent.Enqueue(now);
            _dayCount++;

            return AiQuotaDecision.Acquired;
        }
    }
}

public readonly record struct AiQuotaDecision(bool IsAcquired, bool IsDayExhausted, TimeSpan RetryAfter)
{
    public static AiQuotaDecision Acquired => new(true, false, TimeSpan.Zero);

    public static AiQuotaDecision DayExhausted => new(false, true, TimeSpan.Zero);

    public static AiQuotaDecision WaitFor(TimeSpan delay) =>
        new(false, false, delay > TimeSpan.Zero ? delay : TimeSpan.FromMilliseconds(100));
}

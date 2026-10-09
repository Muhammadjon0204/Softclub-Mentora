using System.ComponentModel.DataAnnotations;

namespace MentorTaskFlow.Infrastructure.Options;

/// <summary>
/// The AI provider and the limits of Приложение L (TZ 22.2, 22.4).
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Enabled"/> is the feature flag of 4.1. With it off the analytics endpoints are untouched
/// and only the summary endpoint answers 404: an installation that has not bought an AI subscription
/// must lose the summary block and nothing else (<c>AI-018</c>, <c>TEST-AI-002</c>).
/// </para>
/// <para>
/// The flag lives in this section rather than under <c>Features:</c> as 4.1 names it, for the same
/// reason it does for Telegram: the switch and the settings it governs belong together, or a
/// deployment ends up with one enabled and the other unconfigured.
/// </para>
/// <para>
/// Every volume limit has a safe default. They are not tuning knobs but the minimisation mechanism of
/// <c>AI-007</c> — a deployment that forgets to set them still sends at most fifty comments and at
/// most twenty thousand characters.
/// </para>
/// </remarks>
public sealed class AiOptions
{
    public const string SectionName = "Ai";

    public const string GeminiProvider = "Gemini";

    public const string AnthropicProvider = "Anthropic";

    public bool Enabled { get; init; }

    /// <summary>
    /// Which API <see cref="ApiKey"/> belongs to: <c>Gemini</c> (the default) or <c>Anthropic</c>.
    /// </summary>
    [Required]
    [RegularExpression("^(Gemini|Anthropic)$", ErrorMessage = "Ai:Provider — Gemini или Anthropic.")]
    public string Provider { get; init; } = GeminiProvider;

    /// <summary>From the environment only, like every other secret (<c>SEC-010</c>).</summary>
    public string? ApiKey { get; init; }

    /// <summary>Named by <c>AI-002</c>; recorded on every report so the result is reproducible.</summary>
    [Required]
    public string ModelId { get; init; } = "gemini-3.8-flash";

    /// <summary>
    /// Gemini only: tried when <see cref="ModelId"/> is overloaded (503) or out of quota (429).
    /// </summary>
    /// <remarks>
    /// Quotas are per model, so a second model is a second allowance — the cheapest way to keep a
    /// report working through a busy hour. Empty disables the fallback.
    /// </remarks>
    public string? FallbackModelId { get; init; } = "gemini-3.5-flash";

    /// <summary>
    /// Gemini only: how much the model reasons before answering.
    /// </summary>
    /// <remarks>
    /// <c>low</c>, because the figures arrive already computed and the task is to describe them.
    /// Thinking tokens are billed and count against <see cref="MaxOutputTokens"/>; <c>minimal</c> is
    /// rejected by the current flash models with 400.
    /// </remarks>
    [RegularExpression("^(low|medium|high)$", ErrorMessage = "Ai:ThinkingLevel — low, medium или high.")]
    public string ThinkingLevel { get; init; } = "low";

    /// <summary>Gemini only. Overridden in tests to point at a local fake.</summary>
    [Required]
    [Url]
    public string GeminiBaseUrl { get; init; } = "https://generativelanguage.googleapis.com/v1beta/";

    /// <summary>
    /// Calls per minute this installation allows itself, across every user (Gemini only).
    /// </summary>
    /// <remarks>
    /// Below the provider's own per-minute quota, so a burst of clicks is queued or refused here with a
    /// clear message instead of turning into a 429 from the provider. Cached reports do not count.
    /// </remarks>
    [Range(1, 1_000)]
    public int MaxRequestsPerMinute { get; init; } = 8;

    /// <summary>Calls per UTC day this installation allows itself (Gemini only).</summary>
    [Range(1, 100_000)]
    public int MaxRequestsPerDay { get; init; } = 200;

    /// <summary>Bumped whenever the prompt changes, which invalidates every cached report.</summary>
    [Required]
    [StringLength(16, MinimumLength = 1)]
    public string PromptVersion { get; init; } = "v1.0";

    [Range(1_000, 200_000)]
    public int MaxInputTokens { get; init; } = 12_000;

    /// <summary>
    /// The response cap. On Gemini it includes the thinking tokens, hence the larger default — at
    /// 1 500 a structured report could be cut off mid-sentence by reasoning the reader never sees.
    /// </summary>
    [Range(256, 32_000)]
    public int MaxOutputTokens { get; init; } = 6_000;

    /// <summary>One attempt (<c>AI-002</c>).</summary>
    [Range(1, 120)]
    public int TimeoutSeconds { get; init; } = 30;

    /// <summary>All attempts together; on exhaustion the answer is 503 (<c>AI-003</c>).</summary>
    [Range(1, 300)]
    public int TotalBudgetSeconds { get; init; } = 90;

    [Range(0, 5)]
    public int MaxRetries { get; init; } = 2;

    [Range(1, 200)]
    public int MaxComments { get; init; } = 50;

    [Range(50, 4_000)]
    public int MaxCommentChars { get; init; } = 500;

    [Range(1_000, 100_000)]
    public int MaxTotalChars { get; init; } = 20_000;

    /// <summary>Forced regenerations per subject per day (<c>AI-011</c>).</summary>
    [Range(1, 100)]
    public int ForceRegenerationPerDay { get; init; } = 1;

    /// <summary>
    /// The delays between attempts, in seconds (<c>AI-003</c>).
    /// </summary>
    /// <remarks>
    /// Two seconds then six. Deliberately short: the whole request is capped at ninety seconds and a
    /// person is waiting for it, so a long backoff would spend the budget on waiting rather than on
    /// attempts.
    /// </remarks>
    public static readonly IReadOnlyList<TimeSpan> RetryDelays =
    [
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(6),
    ];

    /// <summary>Whether the provider can actually be called.</summary>
    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(ApiKey);

    public bool IsGemini => string.Equals(Provider, GeminiProvider, StringComparison.Ordinal);

    /// <summary>
    /// A model id that plainly belongs to the other provider — the classic leftover of switching
    /// <see cref="Provider"/> and forgetting <see cref="ModelId"/>, which would otherwise surface as a
    /// 404 on the first report rather than at startup.
    /// </summary>
    public bool ModelMatchesProvider =>
        IsGemini
            ? !ModelId.StartsWith("claude", StringComparison.OrdinalIgnoreCase)
            : !ModelId.StartsWith("gemini", StringComparison.OrdinalIgnoreCase);
}

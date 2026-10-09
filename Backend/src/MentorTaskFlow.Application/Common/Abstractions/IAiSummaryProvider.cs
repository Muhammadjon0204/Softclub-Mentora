namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// What is sent to the model, already minimised.
/// </summary>
/// <remarks>
/// Two fields, and the split between them is the security boundary of <c>AI-015</c>: the rules live in
/// <see cref="SystemInstructions"/>, the organization's data lives in <see cref="Data"/>, and the two
/// never share a block. Review comments are user-written text; a prompt that interleaves them with
/// instructions has no way to tell the model which sentences it is meant to obey.
/// </remarks>
/// <param name="JsonSchema">
/// When set, the model is asked for JSON matching this schema instead of prose — for reports whose
/// narrative is rendered section by section. Providers without native support fall back to asking
/// for it in the instructions.
/// </param>
public sealed record AiSummaryPrompt(string SystemInstructions, string Data, string? JsonSchema = null);

/// <summary>
/// What came back, plus what it cost (<c>AI-021</c>).
/// </summary>
/// <remarks>
/// <see cref="RequestId"/> is the provider's identifier for the call and is recorded in the audit
/// trail: <c>AI-004</c> asks for a result that can be traced back, and the model, the prompt version
/// and this id are what a support request is answered with.
/// </remarks>
/// <param name="Model">
/// The model that actually answered, when it differs from the configured one — a provider may fall
/// back to a second model when the first is overloaded or out of quota.
/// </param>
public sealed record AiSummaryCompletion(
    string Content,
    int? InputTokens,
    int? OutputTokens,
    string? RequestId,
    string? Model = null);

/// <summary>
/// The model provider, behind an interface so the domain never sees one (<c>AI-001</c>).
/// </summary>
/// <remarks>
/// The abstraction is not ceremony: it is what keeps a swap of provider — or a deployment with none
/// at all — from reaching the analytics module. Metrics stay available whatever happens here
/// (<c>AI-018</c>), and the implementation is chosen at registration by the feature flag.
/// </remarks>
public interface IAiSummaryProvider
{
    /// <summary>Recorded with every generated report so the result is reproducible (<c>AI-004</c>).</summary>
    string ModelId { get; }

    string PromptVersion { get; }

    /// <summary>
    /// Whether the provider can be called at all.
    /// </summary>
    /// <remarks>
    /// False for a deployment with the feature off or without a key. Reported by the readiness probe
    /// as a degraded optional dependency and never as <c>Unhealthy</c> (<c>AI-019</c>): an installation
    /// that has deliberately not bought an AI subscription is not a broken installation.
    /// </remarks>
    bool IsConfigured { get; }

    /// <summary>
    /// Generates the summary, retrying within the time budget of <c>AI-003</c>.
    /// </summary>
    /// <exception cref="Exceptions.ServiceUnavailableException">
    /// The provider is unreachable or the budget is spent — 503 <c>AI_PROVIDER_UNAVAILABLE</c>.
    /// </exception>
    Task<AiSummaryCompletion> GenerateAsync(AiSummaryPrompt prompt, CancellationToken cancellationToken);
}

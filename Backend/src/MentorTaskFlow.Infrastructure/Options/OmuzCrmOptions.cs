using System.ComponentModel.DataAnnotations;

namespace MentorTaskFlow.Infrastructure.Options;

/// <summary>
/// The Omuz CRM read-only integration API (<c>integration/v1</c>): groups, students and the journal
/// the group reports are built from.
/// </summary>
/// <remarks>
/// <see cref="ApiKey"/> comes from the environment only (<c>OmuzCrm__ApiKey</c>), like every other
/// secret: it reads every branch of the CRM, so it never belongs in a file under version control.
/// Without a key the integration is simply «not configured» — nothing fails at startup.
/// </remarks>
public sealed class OmuzCrmOptions
{
    public const string SectionName = "OmuzCrm";

    /// <summary>
    /// Base address of the integration API, up to and including <c>integration/v1</c> — for example
    /// <c>https://crmapi.omuz.tj/api/integration/v1</c>. HTTPS only: the key travels in a header.
    /// </summary>
    [Url]
    public string BaseUrl { get; init; } = "https://testcrmapi.omuz.tj/api/integration/v1";

    public string? ApiKey { get; init; }

    /// <summary>Largest page the API accepts (1–100).</summary>
    [Range(1, 100)]
    public int PageSize { get; init; } = 100;

    /// <summary>
    /// Minimum gap between two requests. The CRM sets no per-key limit, so this one is ours — the
    /// integration must never become the heaviest client of the CRM.
    /// </summary>
    [Range(0, 10_000)]
    public int MinRequestIntervalMs { get; init; } = 150;

    [Range(5, 300)]
    public int TimeoutSeconds { get; init; } = 30;

    /// <summary>The CRM stores and reports times in UTC; dates are shown in this zone (Dushanbe).</summary>
    public string TimeZoneId { get; init; } = "Asia/Dushanbe";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}

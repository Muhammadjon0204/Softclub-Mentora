namespace MentorTaskFlow.Contracts.Integrations;

/// <summary>
/// A mentor's report on one CRM group for one period.
/// </summary>
/// <remarks>
/// <c>Period</c> is the snapshot the report was made from — the figures the Lead reads.
/// <c>DataChanged</c>: the journal was corrected in the CRM after that, and the report can be refreshed
/// (while it is a draft). <c>CanEdit</c>: the caller is the author and the report is still a draft.
/// </remarks>
public sealed record CrmGroupReportDto(
    Guid Id,
    int CrmGroupId,
    string GroupName,
    string CourseName,
    int Week,
    string PeriodLabel,
    DateOnly From,
    DateOnly To,
    string Status,
    Guid AuthorId,
    string AuthorName,
    bool IsMine,
    bool CanEdit,
    string Conclusions,
    string? AiModel,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? SentAt,
    bool DataChanged,
    CrmPeriodDto Period);

/// <summary>
/// <c>GET /integrations/crm/groups/{id}/weeks/{week}/report</c> — the report of a period, or why there
/// is none and whether the caller can make it.
/// </summary>
/// <remarks>
/// <c>Report</c> is null when there is none — or when another mentor's draft exists, which only its
/// author sees; <c>Blocked</c> then says who is writing it. <c>CannotCreate</c> explains a false
/// <c>CanCreate</c>. <c>AiAvailable</c>: the AI can draft the conclusions.
/// </remarks>
public sealed record CrmReportStateDto(
    CrmGroupReportDto? Report,
    bool CanCreate,
    string? CannotCreate,
    string? Blocked,
    bool AiAvailable,
    string? AiError = null);

/// <summary>A row of the report list.</summary>
public sealed record CrmReportListItemDto(
    Guid Id,
    int CrmGroupId,
    string GroupName,
    string CourseName,
    int Week,
    string PeriodLabel,
    DateOnly From,
    DateOnly To,
    string Status,
    string AuthorName,
    bool IsMine,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? SentAt,
    double? AverageTotal,
    int Passed,
    int Support,
    int Risk);

public sealed record CrmReportListDto(IReadOnlyList<CrmReportListItemDto> Reports);

/// <summary><c>PUT …/report</c> — the mentor's edit of the conclusions.</summary>
public sealed record CrmReportConclusionsRequest(string Conclusions);

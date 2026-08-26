namespace MentorTaskFlow.Contracts.Admin.Dashboard;

/// <summary>
/// Filters for <c>GET /admin/dashboard</c>.
/// </summary>
/// <remarks>
/// <c>Period</c> mirrors <see cref="MentorTaskFlow.Contracts.Assignments.AssignmentListQuery.Status"/>:
/// a plain string, not an enum, because the wire values (<c>1m</c>, <c>3m</c>…) are not valid C#
/// identifiers and cannot round-trip through <c>Enum.TryParse</c>. An unrecognised or missing value is
/// not a 400 — the service defaults it to <c>1m</c>, the same fallback the frontend's own MSW handler
/// uses, so a stale bookmark or a client bug degrades gracefully instead of breaking the page.
/// </remarks>
public sealed record DashboardQuery
{
    public string? Period { get; init; }
}

/// <summary>The effective scope the response was computed under (<c>TEN-012a</c>).</summary>
public sealed record DashboardScopeDto(Guid? BranchId, bool IsAllBranches);

/// <summary>
/// Headline counters. Deliberately <b>not</b> period-scoped — every field is a snapshot of right now,
/// which is what the frontend's own tooltips say (<c>«Показатель на сейчас»</c>).
/// </summary>
public sealed record DashboardKpisDto(
    int TotalUsers,
    int ActiveMentors,
    int ActiveAssignments,
    int PendingReview,
    double TotalUsersDeltaPct,
    double ActiveMentorsDeltaPct,
    double ActiveAssignmentsDeltaPct,
    double PendingReviewDeltaPct);

public sealed record ActivityPointDto(string DateLabel, int Submitted, int Approved, int Overdue);

/// <summary>Not period-scoped — a snapshot of the current roster, like the KPIs.</summary>
public sealed record RoleDistributionDto(int Admins, int Leads, int Mentors);

/// <summary>
/// One row of <c>branchHealth</c> — all-time figures, never period-scoped (<c>ANA-009</c>-style: a
/// health signal that reset every time the period changed would be noise, not a status).
/// </summary>
public sealed record BranchHealthRowDto(
    Guid BranchId,
    string BranchName,
    string BranchCode,
    bool IsHeadOffice,
    bool IsActive,
    int CategoriesCount,
    int MentorsCount,
    int ActiveAssignments,
    int PendingReview,
    int HealthPct,
    bool HasActiveAdmin);

public sealed record CategoryHealthRowDto(
    Guid CategoryId,
    string CategoryName,
    Guid BranchId,
    string BranchName,
    string ColorToken,
    bool IsActive,
    string? LeadName,
    int MentorsCount,
    int ActiveAssignments,
    int PendingReview,
    int HealthPct,
    int CompletionRatePct,
    int OnTimeRatePct,
    int ApprovedCount);

/// <summary>
/// One AuditLog row shaped for the dashboard's activity feed — a projection of
/// <see cref="AuditLogEntryDto"/>, not a replacement for it (Приложение D.7 keeps the full shape for
/// <c>GET /admin/audit-log</c>).
/// </summary>
public sealed record DashboardAuditLogEntryDto(
    Guid Id,
    DateTimeOffset At,
    Guid? BranchId,
    string ActorLabel,
    string Action,
    string EntityType,
    string Result);

public sealed record ServiceHealthDto(
    string Id,
    string Name,
    string Status,
    double LatencyMs,
    DateTimeOffset LastCheckedAt,
    string Message);

public sealed record SystemEventDto(Guid Id, DateTimeOffset At, string Level, string Message);

public sealed record SystemHealthDto(
    IReadOnlyList<ServiceHealthDto> Services,
    IReadOnlyList<SystemEventDto> RecentEvents);

public sealed record BestBranchInsightDto(
    string Mode,
    Guid BranchId,
    string BranchName,
    int ActiveAssignments,
    int ApprovedCount,
    int MentorsCount,
    int PerformanceScore,
    int OnTimeRatePct);

public sealed record TopMentorRowDto(
    Guid MentorId,
    string MentorName,
    string? CategoryName,
    int Approved,
    int Active);

public sealed record UpcomingDeadlineDto(Guid Id, string Title, string MentorName, DateTimeOffset DueAt);

public sealed record RecentAssignmentActivityDto(
    Guid Id,
    DateTimeOffset At,
    string MentorName,
    string? LeadName,
    string CategoryName,
    string Title,
    string Status);

/// <summary><c>GET /admin/dashboard</c> — the whole overview page in one response (Phase 1 extensions).</summary>
/// <remarks>
/// One aggregate rather than five parallel requests for five widgets on one screen — the same
/// reasoning the frontend's own MSW handler documents for the mock it replaces.
/// </remarks>
/// <param name="BranchHealth">
/// Null outside the all-branches read context (<c>TEN-034</c>) — a Branch Admin, or an Organization
/// Admin narrowed to one branch, has no cross-branch ranking to show.
/// </param>
public sealed record DashboardResponseDto(
    DashboardScopeDto Scope,
    string Period,
    DashboardKpisDto Kpis,
    IReadOnlyList<ActivityPointDto> ActivitySeries,
    RoleDistributionDto RoleDistribution,
    IReadOnlyList<BranchHealthRowDto>? BranchHealth,
    IReadOnlyList<CategoryHealthRowDto> CategoryHealth,
    IReadOnlyList<DashboardAuditLogEntryDto> RecentAudit,
    SystemHealthDto SystemHealth,
    BestBranchInsightDto BestBranchInsight,
    IReadOnlyList<TopMentorRowDto> TopMentors,
    IReadOnlyList<UpcomingDeadlineDto> UpcomingDeadlines,
    IReadOnlyList<RecentAssignmentActivityDto> RecentAssignmentActivity);

using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Contracts.Admin;
using MentorTaskFlow.Contracts.Admin.Dashboard;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Submissions;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace MentorTaskFlow.Infrastructure.Analytics;

/// <inheritdoc cref="IAdminDashboardService" />
/// <remarks>
/// Reference semantics for every computed field come from the frontend's own pre-existing mock
/// engine (<c>Frontend/src/mocks/domain/reports.ts</c> and <c>mocks/handlers/dashboard.ts</c>), which
/// is the contract this endpoint replaces — the formulas below are a deliberate port of that engine
/// onto real EF Core data, not an independent design. Divergences from the mock's exact mechanics are
/// called out per-method where the mock relied on synthetic-data shortcuts that make no sense against
/// real timestamps (see <see cref="BuildActivitySeries"/> and the KPI deltas in <see cref="GetAsync"/>).
/// </remarks>
public sealed class AdminDashboardService(
    MentorTaskFlowDbContext dbContext,
    IBranchContext branchContext,
    IAuditLogReader auditLogReader,
    HealthCheckService healthCheckService,
    IMemoryCache cache,
    IClock clock) : IAdminDashboardService
{
    /// <summary>
    /// The Postgres/MinIO checks behind <see cref="BuildSystemHealthAsync"/> are live network round
    /// trips to infra shared by the whole deployment, not anything scoped to a request's org/branch/
    /// period — re-pinging them on every dashboard load (e.g. a user flipping the period filter a few
    /// times in a row) buys no fresher information than this TTL already gives, at the cost of two
    /// blocking network calls per request (<c>TokenVersionValidator</c> establishes the same
    /// short-TTL-<see cref="IMemoryCache"/> pattern elsewhere in this codebase for the same reason).
    /// </summary>
    private static readonly TimeSpan SystemHealthCacheDuration = TimeSpan.FromSeconds(20);
    private const string SystemHealthCacheKey = "admin-dashboard:system-health-report";

    private static readonly IReadOnlySet<AssignmentStatus> ActiveStatuses = new HashSet<AssignmentStatus>
    {
        AssignmentStatus.Assigned,
        AssignmentStatus.Submitted,
        AssignmentStatus.InReview,
        AssignmentStatus.NeedsRework,
        AssignmentStatus.Overdue,
    };

    private static readonly IReadOnlySet<AssignmentStatus> PendingReviewStatuses = new HashSet<AssignmentStatus>
    {
        AssignmentStatus.Submitted,
        AssignmentStatus.InReview,
    };

    private static readonly IReadOnlySet<AssignmentStatus> NonWorkingStatuses = new HashSet<AssignmentStatus>
    {
        AssignmentStatus.Draft,
        AssignmentStatus.Suggested,
        AssignmentStatus.Cancelled,
    };

    private static readonly IReadOnlySet<AssignmentStatus> UpcomingDeadlineStatuses = new HashSet<AssignmentStatus>
    {
        AssignmentStatus.Assigned,
        AssignmentStatus.Submitted,
        AssignmentStatus.InReview,
        AssignmentStatus.NeedsRework,
    };

    private static readonly IReadOnlySet<AssignmentStatus> RecentActivityStatuses = new HashSet<AssignmentStatus>
    {
        AssignmentStatus.Assigned,
        AssignmentStatus.Submitted,
        AssignmentStatus.InReview,
        AssignmentStatus.NeedsRework,
        AssignmentStatus.Overdue,
        AssignmentStatus.Approved,
    };

    /// <summary>
    /// System-relevant AuditLog actions for the dashboard's <c>systemHealth.recentEvents</c> feed —
    /// there is no dedicated "system event" entity, per the already-documented recommendation in
    /// <c>docs/phase-1-owner-organization-admin/Phase_1_Product_Extensions_and_Open_Questions.md</c>
    /// §3.6 (reuse AuditLog rather than introduce an Incident entity).
    /// </summary>
    private static readonly IReadOnlySet<string> SystemEventActions = new HashSet<string>(StringComparer.Ordinal)
    {
        AuditActions.SchedulerNoActiveMentor,
        AuditActions.RetentionCleanup,
        AuditActions.StorageOrphanCleanup,
        AuditActions.StorageCrossScopeInconsistency,
        AuditActions.SecurityScopeOverrideRejected,
        AuditActions.SecurityCrossScopeRejected,
        AuditActions.AuthRefreshReuseDetected,
        AuditActions.NotificationRetry,
        AuditActions.BootstrapProvision,
    };

    private static readonly string[] RuMonthAbbreviations =
    [
        "янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек",
    ];

    public async Task<DashboardResponseDto> GetAsync(DashboardQuery query, CancellationToken cancellationToken)
    {
        var organizationId = branchContext.EffectiveOrganizationId;
        var branchId = branchContext.EffectiveBranchId;
        var isAllBranches = branchContext.IsAllBranchesReadContext;
        var period = ParsePeriod(query.Period);
        var now = clock.UtcNow;
        var periodDays = PeriodDays(period);

        // The default 30-day baseline mirrors AnalyticsService.ResolvePeriod's own fallback when no
        // period is named, so an 'all' request still gets a meaningful (rather than undefined) delta
        // baseline for the KPI cards.
        var backwardStart = now - TimeSpan.FromDays(periodDays ?? 30);
        var forwardEnd = periodDays is null ? (DateTimeOffset?)null : now + TimeSpan.FromDays(periodDays.Value);

        // Loaded once, branch-null-aware (null branchId = every branch of the organization), and
        // reused across every computation below — this is the same IgnoreQueryFilters + explicit
        // OrganizationId/BranchId pattern AnalyticsService already uses, so cross-branch reads (the
        // Organization Admin "all branches" mode) are not fought by a branch-level global filter.
        var allAssignments = await dbContext.Assignments
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(a => a.OrganizationId == organizationId)
            .Where(a => branchId == null || a.BranchId == branchId)
            .ToListAsync(cancellationToken);

        var users = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.OrganizationId == organizationId)
            .Where(u => branchId == null || u.BranchId == branchId)
            .Where(u => u.IsActive)
            .ToListAsync(cancellationToken);

        var branches = await dbContext.Branches
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(b => b.OrganizationId == organizationId)
            .Where(b => b.IsActive)
            .ToListAsync(cancellationToken);

        var categories = await dbContext.Categories
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId)
            .Where(c => branchId == null || c.BranchId == branchId)
            .Where(c => c.IsActive)
            .ToListAsync(cancellationToken);

        var submissions = await dbContext.Submissions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId)
            .Where(s => branchId == null || s.BranchId == branchId)
            .ToListAsync(cancellationToken);

        // An assignment counts as "late" if any of its submissions was late — reusing Submission's own
        // IsLate flag (already computed by SubmissionService against CategorySettings/deadlines at
        // upload time) rather than re-deriving lateness from CurrentDueAt here, which would risk
        // drifting from the definition the rest of the system already uses.
        var lateAssignmentIds = submissions.Where(s => s.IsLate).Select(s => s.AssignmentId).ToHashSet();

        var periodAssignments = allAssignments.Where(a => a.UpdatedAt >= backwardStart).ToList();

        var kpis = ComputeKpis(users, allAssignments, backwardStart);
        var activitySeries = BuildActivitySeries(period, periodDays, now, allAssignments, submissions);
        var roleDistribution = ComputeRoleDistribution(users);
        var branchHealth = isAllBranches
            ? branches.Select(b => ComputeBranchHealthRow(b, allAssignments, users, categories)).ToList()
            : null;
        var categoryHealth = categories
            .Select(c => ComputeCategoryHealthRow(c, branches, users, allAssignments, periodAssignments, lateAssignmentIds))
            .ToList();
        var (recentAudit, systemEvents) = await BuildAuditProjectionsAsync(cancellationToken);
        var systemHealth = await BuildSystemHealthAsync(systemEvents, now, cancellationToken);
        var bestBranchInsight = ComputeBestBranchInsight(
            isAllBranches, branchId, branches, allAssignments, users, backwardStart, lateAssignmentIds);
        var topMentors = ComputeTopMentors(users, periodAssignments, categories, limit: 5);
        var upcomingDeadlines = ComputeUpcomingDeadlines(allAssignments, users, now, forwardEnd, limit: 5);
        var recentAssignmentActivity =
            ComputeRecentAssignmentActivity(periodAssignments, users, categories, limit: 6);

        return new DashboardResponseDto(
            new DashboardScopeDto(branchId, isAllBranches),
            period,
            kpis,
            activitySeries,
            roleDistribution,
            branchHealth,
            categoryHealth,
            recentAudit,
            systemHealth,
            bestBranchInsight,
            topMentors,
            upcomingDeadlines,
            recentAssignmentActivity);
    }

    // -----------------------------------------------------------------
    // KPIs
    // -----------------------------------------------------------------

    /// <summary>
    /// Headline counters, snapshot-now, plus period-over-period deltas.
    /// </summary>
    /// <remarks>
    /// The mock this replaces hardcodes its delta percentages as fixed, non-random placeholder
    /// numbers (its own comment: "deterministic but plausible period changes — not random") — it never
    /// actually computed them. A real backend should not ship fake figures, so deltas here compare the
    /// current snapshot against an approximation of the same snapshot at <paramref name="periodStart"/>
    /// (count of records with <c>CreatedAt</c> at or before that date). This is an honest
    /// approximation, not a true point-in-time status reconstruction (which would require replaying
    /// TaskEvent history) — flagged as a judgment call, not a hidden assumption.
    /// </remarks>
    private static DashboardKpisDto ComputeKpis(
        IReadOnlyList<User> users,
        IReadOnlyList<Assignment> assignments,
        DateTimeOffset periodStart)
    {
        var totalUsers = users.Count;
        var activeMentors = users.Count(u => u.Role == UserRole.Mentor && u.IsActive);
        var activeAssignments = assignments.Count(a => ActiveStatuses.Contains(a.Status));
        var pendingReview = assignments.Count(a => PendingReviewStatuses.Contains(a.Status));

        var usersAtStart = users.Count(u => u.CreatedAt <= periodStart);
        var mentorsAtStart = users.Count(u => u.Role == UserRole.Mentor && u.IsActive && u.CreatedAt <= periodStart);
        var assignmentsAtStart = assignments.Count(a => ActiveStatuses.Contains(a.Status) && a.CreatedAt <= periodStart);
        var pendingAtStart = assignments.Count(a => PendingReviewStatuses.Contains(a.Status) && a.CreatedAt <= periodStart);

        return new DashboardKpisDto(
            totalUsers,
            activeMentors,
            activeAssignments,
            pendingReview,
            DeltaPct(totalUsers, usersAtStart),
            DeltaPct(activeMentors, mentorsAtStart),
            DeltaPct(activeAssignments, assignmentsAtStart),
            DeltaPct(pendingReview, pendingAtStart));
    }

    private static double DeltaPct(int current, int baseline) =>
        baseline == 0 ? 0 : Math.Round((current - baseline) / (double)baseline * 100, 1);

    // -----------------------------------------------------------------
    // Activity series
    // -----------------------------------------------------------------

    /// <summary>
    /// Divergence from the mock, deliberate: the mock buckets by a stable hash of the assignment id
    /// rather than by real time, because every fixture assignment's <c>lastActivityAt</c> clusters
    /// within the last six hours (its own comment says so) — a real hash-bucket trick would be actively
    /// wrong against genuine, spread-out timestamps. This bucket real events into real, contiguous time
    /// windows across the period instead, which is the correct generalisation once the data is real.
    /// </summary>
    private static IReadOnlyList<ActivityPointDto> BuildActivitySeries(
        string period,
        int? periodDays,
        DateTimeOffset now,
        IReadOnlyList<Assignment> allAssignments,
        IReadOnlyList<Submission> allSubmissions)
    {
        var buckets = BuildBuckets(period, periodDays, now);

        var points = new ActivityPointDto[buckets.Count];
        for (var i = 0; i < buckets.Count; i++)
        {
            var (start, end, label) = buckets[i];

            var submitted = allSubmissions.Count(s => s.CreatedAt >= start && s.CreatedAt < end);
            var approved = allAssignments.Count(a => a.ApprovedAt is { } at && at >= start && at < end);
            var overdue = allAssignments.Count(a => a.OverdueAt is { } at && at >= start && at < end);

            points[i] = new ActivityPointDto(label, submitted, approved, overdue);
        }

        return points;
    }

    private static IReadOnlyList<(DateTimeOffset Start, DateTimeOffset End, string Label)> BuildBuckets(
        string period, int? periodDays, DateTimeOffset now)
    {
        var pointCount = period switch
        {
            "1m" => 10,
            "3m" => 12,
            "6m" => 6,
            _ => 12, // '1y' and 'all' — 'all' shares the 1y window, matching the mock (no real data older
                     // than the demo's ~35-day fixture window made a wider window meaningful there
                     // either, and a year is a reasonable default horizon for "all" on real data too).
        };

        var isMonthly = period is "6m" or "1y" or "all";

        if (!isMonthly)
        {
            var totalDays = periodDays ?? 30;
            var buckets = new List<(DateTimeOffset, DateTimeOffset, string)>();
            var bucketSpan = TimeSpan.FromDays((double)totalDays / pointCount);
            var start = now - TimeSpan.FromDays(totalDays);

            for (var i = 0; i < pointCount; i++)
            {
                var bucketStart = start + (bucketSpan * i);
                var bucketEnd = i == pointCount - 1 ? now : start + (bucketSpan * (i + 1));
                buckets.Add((bucketStart, bucketEnd, FormatDayLabel(bucketEnd)));
            }

            return buckets;
        }

        var monthly = new List<(DateTimeOffset, DateTimeOffset, string)>();
        var firstOfCurrentMonth = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

        for (var i = pointCount - 1; i >= 0; i--)
        {
            var bucketStart = firstOfCurrentMonth.AddMonths(-i);
            var bucketEnd = bucketStart.AddMonths(1);
            monthly.Add((bucketStart, i == 0 ? now : bucketEnd, RuMonthAbbreviations[bucketStart.Month - 1]));
        }

        return monthly;
    }

    private static string FormatDayLabel(DateTimeOffset date) =>
        $"{date.Day:00} {RuMonthAbbreviations[date.Month - 1]}";

    // -----------------------------------------------------------------
    // Role distribution
    // -----------------------------------------------------------------

    private static RoleDistributionDto ComputeRoleDistribution(IReadOnlyList<User> users) => new(
        users.Count(u => u.Role == UserRole.Admin),
        users.Count(u => u.Role == UserRole.Lead),
        users.Count(u => u.Role == UserRole.Mentor));

    // -----------------------------------------------------------------
    // Branch health (all-time — never period-scoped, matching the mock)
    // -----------------------------------------------------------------

    private static BranchHealthRowDto ComputeBranchHealthRow(
        Branch branch,
        IReadOnlyList<Assignment> allAssignments,
        IReadOnlyList<User> users,
        IReadOnlyList<Category> categories)
    {
        var branchAssignments = allAssignments.Where(a => a.BranchId == branch.Id).ToList();
        var active = branchAssignments.Count(a => ActiveStatuses.Contains(a.Status));
        var pending = branchAssignments.Count(a => PendingReviewStatuses.Contains(a.Status));
        var overdue = branchAssignments.Count(a => a.Status == AssignmentStatus.Overdue);
        var workingTotal = branchAssignments.Count(a => !NonWorkingStatuses.Contains(a.Status));
        var healthPct = workingTotal == 0 ? 100 : (int)Math.Round(100 - (overdue / (double)workingTotal * 100));

        var mentorsCount = users.Count(u => u.BranchId == branch.Id && u.Role == UserRole.Mentor && u.IsActive);
        var hasActiveAdmin = users.Any(u =>
            u.BranchId == branch.Id && u.Role == UserRole.Admin && u.AdminScope == AdminScope.Branch && u.IsActive);

        return new BranchHealthRowDto(
            branch.Id,
            branch.Name,
            branch.Code,
            branch.IsHeadOffice,
            branch.IsActive,
            categories.Count(c => c.BranchId == branch.Id),
            mentorsCount,
            active,
            pending,
            healthPct,
            hasActiveAdmin);
    }

    // -----------------------------------------------------------------
    // Category health (period-scoped)
    // -----------------------------------------------------------------

    private readonly record struct PerformanceMetrics(
        int CompletionRatePct, int OnTimeRatePct, int? FirstPassApprovalRatePct, int ApprovedCount, int WorkingTotal);

    private static PerformanceMetrics ComputePerformanceMetrics(
        IReadOnlyList<Assignment> assignments, IReadOnlySet<Guid> lateAssignmentIds)
    {
        var working = assignments.Where(a => !NonWorkingStatuses.Contains(a.Status)).ToList();
        var workingTotal = working.Count;
        var approved = working.Where(a => a.Status == AssignmentStatus.Approved).ToList();
        var approvedCount = approved.Count;
        var lateCount = working.Count(a => lateAssignmentIds.Contains(a.Id));
        var firstPass = approved.Count(a => !lateAssignmentIds.Contains(a.Id));

        return new PerformanceMetrics(
            workingTotal == 0 ? 0 : (int)Math.Round(approvedCount / (double)workingTotal * 100),
            workingTotal == 0 ? 100 : (int)Math.Round((workingTotal - lateCount) / (double)workingTotal * 100),
            approvedCount == 0 ? null : (int)Math.Round(firstPass / (double)approvedCount * 100),
            approvedCount,
            workingTotal);
    }

    /// <summary>completion×0.40 + onTime×0.35 + firstPassApproval×0.25; the last term drops out (and the
    /// remaining weights renormalise) while no assignment has been approved yet.</summary>
    private static int WeightedPerformanceScore(PerformanceMetrics metrics)
    {
        var parts = new List<(double Value, double Weight)>
        {
            (metrics.CompletionRatePct, 0.40),
            (metrics.OnTimeRatePct, 0.35),
        };

        if (metrics.FirstPassApprovalRatePct is { } firstPass)
        {
            parts.Add((firstPass, 0.25));
        }

        var weightTotal = parts.Sum(p => p.Weight);
        if (weightTotal == 0)
        {
            return 0;
        }

        var raw = parts.Sum(p => p.Value * p.Weight) / weightTotal;
        return Math.Max(0, Math.Min(100, (int)Math.Round(raw)));
    }

    private static CategoryHealthRowDto ComputeCategoryHealthRow(
        Category category,
        IReadOnlyList<Branch> branches,
        IReadOnlyList<User> users,
        IReadOnlyList<Assignment> allAssignments,
        IReadOnlyList<Assignment> periodAssignments,
        IReadOnlySet<Guid> lateAssignmentIds)
    {
        var categoryPeriodAssignments = periodAssignments.Where(a => a.CategoryId == category.Id).ToList();
        var lead = users.FirstOrDefault(u => u.CategoryId == category.Id && u.Role == UserRole.Lead && u.IsActive);
        var mentorsCount = users.Count(u => u.CategoryId == category.Id && u.Role == UserRole.Mentor && u.IsActive);
        var active = categoryPeriodAssignments.Count(a => ActiveStatuses.Contains(a.Status));
        var pending = categoryPeriodAssignments.Count(a => PendingReviewStatuses.Contains(a.Status));
        var overdue = categoryPeriodAssignments.Count(a => a.Status == AssignmentStatus.Overdue);
        var metrics = ComputePerformanceMetrics(categoryPeriodAssignments, lateAssignmentIds);
        var healthPct = metrics.WorkingTotal == 0
            ? 100
            : (int)Math.Round(100 - (overdue / (double)metrics.WorkingTotal * 100));
        var branchName = branches.FirstOrDefault(b => b.Id == category.BranchId)?.Name ?? "—";

        return new CategoryHealthRowDto(
            category.Id,
            category.Name,
            category.BranchId,
            branchName,
            CategoryColorToken(category.Id),
            category.IsActive,
            lead?.FullName,
            mentorsCount,
            active,
            pending,
            healthPct,
            metrics.CompletionRatePct,
            metrics.OnTimeRatePct,
            metrics.ApprovedCount);
    }

    /// <summary>
    /// The mock draws <c>colorToken</c> from a fixed field on its fixture data. The real Category
    /// entity has no such field (TZ 10.2 does not define one) — cycling three tokens by a stable hash
    /// of the id keeps the UI's three-colour rotation working without inventing a new persisted column
    /// for a purely cosmetic value.
    /// </summary>
    private static string CategoryColorToken(Guid categoryId)
    {
        string[] tokens = ["indigo", "blue", "cyan"];
        var hash = categoryId.GetHashCode();
        var index = ((hash % tokens.Length) + tokens.Length) % tokens.Length;
        return tokens[index];
    }

    // -----------------------------------------------------------------
    // Best branch insight
    // -----------------------------------------------------------------

    private readonly record struct BranchInsightSummary(
        Guid BranchId, string BranchName, int ActiveAssignments, int ApprovedCount, int MentorsCount,
        int PerformanceScore, int OnTimeRatePct);

    private static BranchInsightSummary BuildBranchInsightSummary(
        Branch branch,
        IReadOnlyList<Assignment> allAssignments,
        DateTimeOffset backwardStart,
        IReadOnlySet<Guid> lateAssignmentIds,
        IReadOnlyList<User> usersForMentorCount)
    {
        var periodAssignments = allAssignments
            .Where(a => a.BranchId == branch.Id && a.UpdatedAt >= backwardStart)
            .ToList();
        var metrics = ComputePerformanceMetrics(periodAssignments, lateAssignmentIds);

        return new BranchInsightSummary(
            branch.Id,
            branch.Name,
            periodAssignments.Count(a => ActiveStatuses.Contains(a.Status)),
            metrics.ApprovedCount,
            usersForMentorCount.Count(u => u.BranchId == branch.Id && u.Role == UserRole.Mentor && u.IsActive),
            WeightedPerformanceScore(metrics),
            metrics.OnTimeRatePct);
    }

    /// <summary>
    /// Best = highest performanceScore; ties broken by approvedCount, then onTimeRatePct, then a
    /// stable alphabetical fallback — no randomness, matching the mock exactly (its own comment
    /// explains why: two unexplained "100"s would look like a bug).
    /// </summary>
    private static BestBranchInsightDto ComputeBestBranchInsight(
        bool isAllBranches,
        Guid? scopeBranchId,
        IReadOnlyList<Branch> branches,
        IReadOnlyList<Assignment> allAssignments,
        IReadOnlyList<User> users,
        DateTimeOffset backwardStart,
        IReadOnlySet<Guid> lateAssignmentIds)
    {
        // allAssignments/users were loaded org-wide whenever isAllBranches is true (branchId is null in
        // that case by definition), so no extra query is needed here for the cross-branch comparison.
        if (isAllBranches)
        {
            var summaries = branches
                .Select(b => BuildBranchInsightSummary(b, allAssignments, backwardStart, lateAssignmentIds, users))
                .ToList();

            var best = summaries.Aggregate((leader, candidate) =>
            {
                if (candidate.PerformanceScore != leader.PerformanceScore)
                {
                    return candidate.PerformanceScore > leader.PerformanceScore ? candidate : leader;
                }

                if (candidate.ApprovedCount != leader.ApprovedCount)
                {
                    return candidate.ApprovedCount > leader.ApprovedCount ? candidate : leader;
                }

                if (candidate.OnTimeRatePct != leader.OnTimeRatePct)
                {
                    return candidate.OnTimeRatePct > leader.OnTimeRatePct ? candidate : leader;
                }

                return string.CompareOrdinal(candidate.BranchName, leader.BranchName) < 0 ? candidate : leader;
            });

            return new BestBranchInsightDto(
                "best-of-all", best.BranchId, best.BranchName, best.ActiveAssignments,
                best.ApprovedCount, best.MentorsCount, best.PerformanceScore, best.OnTimeRatePct);
        }

        var branch = branches.FirstOrDefault(b => b.Id == scopeBranchId) ?? branches[0];
        var summary = BuildBranchInsightSummary(branch, allAssignments, backwardStart, lateAssignmentIds, users);

        return new BestBranchInsightDto(
            "single-branch", summary.BranchId, summary.BranchName, summary.ActiveAssignments,
            summary.ApprovedCount, summary.MentorsCount, summary.PerformanceScore, summary.OnTimeRatePct);
    }

    // -----------------------------------------------------------------
    // Top mentors
    // -----------------------------------------------------------------

    private static IReadOnlyList<TopMentorRowDto> ComputeTopMentors(
        IReadOnlyList<User> users, IReadOnlyList<Assignment> periodAssignments, IReadOnlyList<Category> categories, int limit)
    {
        var mentors = users.Where(u => u.Role == UserRole.Mentor && u.IsActive);

        return mentors
            .Select(mentor =>
            {
                var own = periodAssignments.Where(a => a.AssignedToId == mentor.Id).ToList();
                return new TopMentorRowDto(
                    mentor.Id,
                    mentor.FullName,
                    mentor.CategoryId is { } categoryId
                        ? categories.FirstOrDefault(c => c.Id == categoryId)?.Name
                        : null,
                    own.Count(a => a.Status == AssignmentStatus.Approved),
                    own.Count(a => ActiveStatuses.Contains(a.Status)));
            })
            .OrderByDescending(m => m.Approved)
            .ThenByDescending(m => m.Active)
            .ThenBy(m => m.MentorName, StringComparer.Ordinal)
            .Take(limit)
            .ToList();
    }

    // -----------------------------------------------------------------
    // Upcoming deadlines — forward window, not backward
    // -----------------------------------------------------------------

    private static IReadOnlyList<UpcomingDeadlineDto> ComputeUpcomingDeadlines(
        IReadOnlyList<Assignment> allAssignments,
        IReadOnlyList<User> users,
        DateTimeOffset now,
        DateTimeOffset? forwardEnd,
        int limit) =>
        allAssignments
            .Where(a => UpcomingDeadlineStatuses.Contains(a.Status) && a.CurrentDueAt > now)
            .Where(a => forwardEnd is null || a.CurrentDueAt <= forwardEnd)
            .OrderBy(a => a.CurrentDueAt)
            .Take(limit)
            .Select(a => new UpcomingDeadlineDto(
                a.Id,
                a.Title,
                users.FirstOrDefault(u => u.Id == a.AssignedToId)?.FullName ?? "—",
                a.CurrentDueAt))
            .ToList();

    // -----------------------------------------------------------------
    // Recent assignment activity
    // -----------------------------------------------------------------

    private static IReadOnlyList<RecentAssignmentActivityDto> ComputeRecentAssignmentActivity(
        IReadOnlyList<Assignment> periodAssignments,
        IReadOnlyList<User> users,
        IReadOnlyList<Category> categories,
        int limit) =>
        periodAssignments
            .Where(a => RecentActivityStatuses.Contains(a.Status))
            .OrderByDescending(a => a.UpdatedAt)
            .Take(limit)
            .Select(a => new RecentAssignmentActivityDto(
                a.Id,
                a.UpdatedAt,
                users.FirstOrDefault(u => u.Id == a.AssignedToId)?.FullName ?? "—",
                a.AssignedById is { } assignedById ? users.FirstOrDefault(u => u.Id == assignedById)?.FullName : null,
                categories.FirstOrDefault(c => c.Id == a.CategoryId)?.Name ?? "—",
                a.Title,
                a.Status.ToString()))
            .ToList();

    // -----------------------------------------------------------------
    // Audit projections (recentAudit + the system-events subset of systemHealth)
    // -----------------------------------------------------------------

    /// <summary>
    /// One <see cref="IAuditLogReader"/> call feeds both <c>recentAudit</c> and the system-action
    /// subset behind <c>systemHealth.recentEvents</c> — reusing the reader's own scope/authorization
    /// logic exactly once rather than re-querying AuditLog directly, which would risk drifting from the
    /// branch-redaction rules that service already implements (e.g. <c>TEN-049</c>'s
    /// user.left_branch/user.joined_branch split).
    /// </summary>
    private async Task<(IReadOnlyList<DashboardAuditLogEntryDto> RecentAudit, IReadOnlyList<AuditLogEntryDto> SystemEvents)>
        BuildAuditProjectionsAsync(CancellationToken cancellationToken)
    {
        var page = await auditLogReader.QueryAsync(new AuditLogQuery { Page = 1, PageSize = 50 }, cancellationToken);

        var actorIds = page.Items.Where(e => e.ActorId is not null).Select(e => e.ActorId!.Value).Distinct().ToList();
        var actorNames = actorIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.Users.IgnoreQueryFilters().AsNoTracking()
                .Where(u => actorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

        string ActorLabel(AuditLogEntryDto entry) =>
            entry.ActorType == nameof(AuditActorType.System)
                ? "Система"
                : entry.ActorId is { } id && actorNames.TryGetValue(id, out var name)
                    ? name
                    : entry.ActorRole ?? "Пользователь";

        var recentAudit = page.Items
            .Take(6)
            .Select(e => new DashboardAuditLogEntryDto(
                e.Id, e.OccurredAt, e.BranchId, ActorLabel(e), e.Action, e.EntityType, e.Result))
            .ToList();

        var systemEvents = page.Items.Where(e => SystemEventActions.Contains(e.Action)).ToList();

        return (recentAudit, systemEvents);
    }

    // -----------------------------------------------------------------
    // System health
    // -----------------------------------------------------------------

    private static readonly IReadOnlyDictionary<string, string> ServiceDisplayNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["postgres"] = "База данных",
        ["storage"] = "Хранилище файлов",
        ["ai"] = "AI-провайдер",
    };

    private async Task<SystemHealthDto> BuildSystemHealthAsync(
        IReadOnlyList<AuditLogEntryDto> systemEventEntries, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var report = await GetCachedHealthReportAsync(cancellationToken);

        var services = report.Entries
            .Select(entry => new ServiceHealthDto(
                entry.Key,
                ServiceDisplayNames.GetValueOrDefault(entry.Key, entry.Key),
                MapHealthStatus(entry.Value.Status),
                Math.Round(entry.Value.Duration.TotalMilliseconds, 1),
                now,
                entry.Value.Description ?? entry.Value.Status.ToString()))
            .ToList();

        var recentEvents = systemEventEntries
            .Take(5)
            .Select(e => new SystemEventDto(e.Id, e.OccurredAt, MapEventLevel(e), e.Action))
            .ToList();

        return new SystemHealthDto(services, recentEvents);
    }

    private async Task<HealthReport> GetCachedHealthReportAsync(CancellationToken cancellationToken)
    {
        if (cache.TryGetValue<HealthReport>(SystemHealthCacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        var report = await healthCheckService.CheckHealthAsync(check => check.Tags.Contains("ready"), cancellationToken);
        cache.Set(SystemHealthCacheKey, report, SystemHealthCacheDuration);
        return report;
    }

    private static string MapHealthStatus(HealthStatus status) => status switch
    {
        HealthStatus.Healthy => "Operational",
        HealthStatus.Degraded => "Degraded",
        _ => "Unavailable",
    };

    private static string MapEventLevel(AuditLogEntryDto entry) =>
        entry.Result == nameof(AuditResult.Failure) ? "error"
        : entry.Action.StartsWith("security.", StringComparison.Ordinal) ? "warning"
        : "info";

    // -----------------------------------------------------------------
    // Period parsing
    // -----------------------------------------------------------------

    /// <summary>Unrecognised or missing value defaults to <c>1m</c> — matches the mock's own fallback exactly.</summary>
    private static string ParsePeriod(string? raw) =>
        raw is "all" or "1m" or "3m" or "6m" or "1y" ? raw : "1m";

    private static int? PeriodDays(string period) => period switch
    {
        "1m" => 30,
        "3m" => 90,
        "6m" => 180,
        "1y" => 365,
        _ => null, // 'all'
    };
}

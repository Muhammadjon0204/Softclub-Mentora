using MentorTaskFlow.Contracts.Admin.Dashboard;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// The Admin Dashboard overview (Phase 1 product extensions, <c>docs/phase-1-owner-organization-admin</c>).
/// </summary>
/// <remarks>
/// <para>
/// One aggregate call rather than composing <see cref="IAnalyticsService"/>, <see cref="IAuditLogReader"/>
/// and the health-check subsystem on the frontend: the page renders a dozen widgets at once, and five
/// parallel round trips for one screen is worse than one service doing the composing server-side.
/// </para>
/// <para>
/// Scope follows <see cref="MentorTaskFlow.Application.Common.Tenancy.IBranchContext"/> exactly as
/// every other admin endpoint does — a Branch Admin always sees their own branch, an Organization
/// Admin sees either one branch (narrowed by <c>X-MTF-Branch-Id</c>) or every branch of the
/// organization. Cross-branch ranking (<c>branchHealth</c>, the <c>best-of-all</c> insight mode) exists
/// only in the all-branches read context (<c>TEN-034</c>).
/// </para>
/// </remarks>
public interface IAdminDashboardService
{
    Task<DashboardResponseDto> GetAsync(DashboardQuery query, CancellationToken cancellationToken);
}

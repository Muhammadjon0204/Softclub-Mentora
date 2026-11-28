using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Users;

/// <summary>
/// Checked against the database on every request that names a team, so removing somebody from a team
/// takes effect at once rather than when their token expires.
/// </summary>
public sealed class TeamContextResolver(MentorTaskFlowDbContext dbContext) : ITeamContextResolver
{
    public async Task<IReadOnlyList<TeamMembershipSeat>> ListMembershipsAsync(
        Guid userId,
        Guid organizationId,
        CancellationToken cancellationToken) =>
        await dbContext.TeamMemberships
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(m => m.UserId == userId && m.OrganizationId == organizationId)
            .Select(m => new TeamMembershipSeat(m.CategoryId, m.Role == TeamRole.Lead ? UserRole.Lead : UserRole.Mentor))
            .ToListAsync(cancellationToken);

    public async Task<TeamSeat?> ResolveAsync(Guid userId, Guid organizationId, Guid teamId, CancellationToken cancellationToken)
    {
        // IgnoreQueryFilters: this runs before the tenant scope is established, and pins the
        // organization and the person itself.
        var row = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == userId && u.OrganizationId == organizationId && u.IsActive && u.BranchId != null)
            .Select(u => new
            {
                u.Role,
                BranchId = u.BranchId!.Value,
                u.CategoryId,
                Membership = dbContext.TeamMemberships.IgnoreQueryFilters()
                    .Where(m => m.UserId == u.Id && m.CategoryId == teamId && m.BranchId == u.BranchId)
                    .Select(m => (TeamRole?)m.Role)
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            return null;
        }

        if (row.Membership is { } membership)
        {
            return new TeamSeat(membership is TeamRole.Lead ? UserRole.Lead : UserRole.Mentor, row.BranchId);
        }

        // The account's own team needs no membership row.
        return row.CategoryId == teamId && row.Role is UserRole.Lead or UserRole.Mentor
            ? new TeamSeat(row.Role, row.BranchId)
            : null;
    }
}

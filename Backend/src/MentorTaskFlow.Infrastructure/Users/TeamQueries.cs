using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Users;

/// <summary>
/// «Who is in this team», «who leads it» and «what is this person there», counting both the main team
/// on the account and <see cref="TeamMembership"/> rows. Every place that used to compare
/// <c>CategoryId</c> for another person asks here instead.
/// </summary>
/// <remarks>
/// The membership subqueries ignore the tenant filter on purpose: the caller has already scoped the
/// users query, a membership is only created inside the member's own branch, and a transfer to another
/// branch removes them.
/// </remarks>
internal static class TeamQueries
{
    public static IQueryable<User> InTeam(this IQueryable<User> users, MentorTaskFlowDbContext db, Guid categoryId) =>
        users.Where(u => u.CategoryId == categoryId
                         || db.TeamMemberships.IgnoreQueryFilters().Any(m => m.UserId == u.Id && m.CategoryId == categoryId));

    /// <summary>The active lead of a team — at most one (<c>assert_team_has_one_lead</c>).</summary>
    public static IQueryable<User> LeadingTeam(this IQueryable<User> users, MentorTaskFlowDbContext db, Guid categoryId) =>
        users.Where(u => u.IsActive
                         && ((u.CategoryId == categoryId && u.Role == UserRole.Lead)
                             || db.TeamMemberships.IgnoreQueryFilters().Any(m =>
                                 m.UserId == u.Id && m.CategoryId == categoryId && m.Role == TeamRole.Lead)));

    /// <summary>The team's mentors. A «участник» is in the team without being one.</summary>
    public static IQueryable<User> TeachingIn(this IQueryable<User> users, MentorTaskFlowDbContext db, Guid categoryId) =>
        users.Where(u => (u.CategoryId == categoryId
                          && u.Role == UserRole.Mentor
                          && !db.TeamMemberships.IgnoreQueryFilters().Any(m =>
                              m.UserId == u.Id && m.CategoryId == categoryId && m.Role != TeamRole.Mentor))
                         || db.TeamMemberships.IgnoreQueryFilters().Any(m =>
                             m.UserId == u.Id && m.CategoryId == categoryId && m.Role == TeamRole.Mentor));

    /// <summary>What the person is in this team, or null when they are not in it.</summary>
    public static async Task<TeamRole?> RoleInTeamAsync(
        this MentorTaskFlowDbContext db,
        Guid userId,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var row = await db.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                u.Role,
                u.CategoryId,
                Membership = db.TeamMemberships.IgnoreQueryFilters()
                    .Where(m => m.UserId == u.Id && m.CategoryId == categoryId)
                    .Select(m => (TeamRole?)m.Role)
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            return null;
        }

        return row.Membership ?? (row.CategoryId == categoryId ? MainTeamRole(row.Role) : null);
    }

    /// <summary>The title the account itself gives in its main team.</summary>
    public static TeamRole? MainTeamRole(UserRole role) => role switch
    {
        UserRole.Lead => TeamRole.Lead,
        UserRole.Mentor => TeamRole.Mentor,
        _ => null,
    };
}

using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Users;

/// <summary>One person's place in one team.</summary>
internal sealed record TeamPlace(Guid CategoryId, TeamRole Role, bool IsMain);

/// <summary>
/// The teams of a set of already loaded people — for screens and counts that look at many at once,
/// where a query per person would not do.
/// </summary>
internal sealed class TeamRoster
{
    private readonly ILookup<Guid, TeamPlace> _places;

    private TeamRoster(ILookup<Guid, TeamPlace> places) => _places = places;

    public static async Task<TeamRoster> LoadAsync(
        MentorTaskFlowDbContext db,
        IReadOnlyCollection<User> users,
        CancellationToken cancellationToken)
    {
        var ids = users.Select(u => u.Id).ToArray();

        var rows = await db.TeamMemberships
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(m => ids.Contains(m.UserId))
            .Select(m => new { m.UserId, m.CategoryId, m.Role })
            .ToListAsync(cancellationToken);

        var memberships = rows.ToLookup(r => r.UserId);

        return new TeamRoster(users
            .SelectMany(user => Places(user, memberships[user.Id].ToDictionary(m => m.CategoryId, m => m.Role))
                .Select(place => (user.Id, place)))
            .ToLookup(p => p.Id, p => p.place));
    }

    /// <summary>The main team first.</summary>
    public IEnumerable<TeamPlace> Of(Guid userId) => _places[userId];

    public TeamPlace? In(Guid userId, Guid categoryId) => _places[userId].FirstOrDefault(p => p.CategoryId == categoryId);

    public bool Teaches(Guid userId) => _places[userId].Any(p => p.Role is TeamRole.Mentor);

    public bool TeachesIn(Guid userId, Guid categoryId) => In(userId, categoryId)?.Role is TeamRole.Mentor;

    public bool Leads(Guid userId, Guid categoryId) => In(userId, categoryId)?.Role is TeamRole.Lead;

    private static IEnumerable<TeamPlace> Places(User user, Dictionary<Guid, TeamRole> memberships)
    {
        if (user.CategoryId is { } main && TeamQueries.MainTeamRole(user.Role) is { } mainRole)
        {
            // A row for the main team only renames the account's role there («участник»).
            yield return new TeamPlace(main, memberships.GetValueOrDefault(main, mainRole), IsMain: true);
        }

        foreach (var (categoryId, role) in memberships)
        {
            if (categoryId != user.CategoryId)
            {
                yield return new TeamPlace(categoryId, role, IsMain: false);
            }
        }
    }
}

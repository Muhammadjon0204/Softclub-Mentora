using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Realtime;

namespace MentorTaskFlow.Api.Realtime;

/// <summary>
/// Which connections may hear about which change — the realtime mirror of the read scopes.
/// </summary>
/// <remarks>
/// <para>
/// A connection's groups come from the validated token alone, the way every read derives its scope
/// (<c>TEN-030a</c>): an Organization Admin hears the whole organization, a Branch Admin their branch,
/// a Lead their category, a Mentor only what is about them. Leads and Mentors also join their
/// category's team group, which carries nothing but the shared schedule.
/// </para>
/// <para>
/// A Mentor carries the same category claim as their Lead but never joins the category group: that
/// would tell them when a colleague's assignment or account changes, which no endpoint lets a Mentor
/// see.
/// </para>
/// </remarks>
public static class RealtimeGroups
{
    public static IReadOnlyList<string> For(ICurrentUserContext user) => (user.Role, user.AdminScope) switch
    {
        (UserRole.Admin, AdminScope.Organization) => [Organization(user.OrganizationId)],
        (UserRole.Admin, AdminScope.Branch) => [Branch(user.BranchId!.Value)],
        (UserRole.Lead, _) => [Category(user.CategoryId!.Value), Team(user.CategoryId!.Value)],
        _ => [User(user.UserId), Team(user.CategoryId!.Value)],
    };

    public static IReadOnlyList<string> For(RealtimeSignal signal)
    {
        var groups = new List<string> { Organization(signal.OrganizationId) };

        if (signal.BranchId is { } branch)
        {
            groups.Add(Branch(branch));
        }

        if (signal.CategoryId is { } category)
        {
            groups.Add(Category(category));

            if (signal.Kind == RealtimeKinds.Schedule)
            {
                groups.Add(Team(category));
            }
        }

        groups.AddRange(signal.UserIds.Select(User));
        return groups;
    }

    private static string Organization(Guid id) => $"org:{id}";

    private static string Branch(Guid id) => $"branch:{id}";

    private static string Category(Guid id) => $"category:{id}";

    private static string Team(Guid id) => $"team:{id}";

    private static string User(Guid id) => $"user:{id}";
}

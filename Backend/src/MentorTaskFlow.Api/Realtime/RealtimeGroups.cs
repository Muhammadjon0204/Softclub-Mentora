using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Realtime;

namespace MentorTaskFlow.Api.Realtime;

/// <summary>
/// Which connections may hear about which assignment — the realtime mirror of the read scopes.
/// </summary>
/// <remarks>
/// <para>
/// A connection joins exactly one group, derived from the validated token alone, the way every read
/// derives its scope (<c>TEN-030a</c>): an Organization Admin hears the whole organization, a Branch
/// Admin their branch, a Lead their category, a Mentor only assignments they hold or just lost.
/// </para>
/// <para>
/// A Mentor carries the same category claim as their Lead but must not join the category group: that
/// would tell them when a colleague's assignment changes, which no endpoint lets a Mentor see.
/// </para>
/// </remarks>
public static class RealtimeGroups
{
    public static string For(ICurrentUserContext user) => (user.Role, user.AdminScope) switch
    {
        (UserRole.Admin, AdminScope.Organization) => Organization(user.OrganizationId),
        (UserRole.Admin, AdminScope.Branch) => Branch(user.BranchId!.Value),
        (UserRole.Lead, _) => Category(user.CategoryId!.Value),
        _ => User(user.UserId),
    };

    public static IReadOnlyList<string> For(AssignmentChangeSignal signal) =>
    [
        Organization(signal.OrganizationId),
        Branch(signal.BranchId),
        Category(signal.CategoryId),
        .. signal.UserIds.Select(User),
    ];

    private static string Organization(Guid id) => $"org:{id}";

    private static string Branch(Guid id) => $"branch:{id}";

    private static string Category(Guid id) => $"category:{id}";

    private static string User(Guid id) => $"user:{id}";
}

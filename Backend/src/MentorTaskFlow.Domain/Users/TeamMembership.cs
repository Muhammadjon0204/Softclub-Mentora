using MentorTaskFlow.Domain.Common;
using MentorTaskFlow.Domain.Tenancy;

namespace MentorTaskFlow.Domain.Users;

/// <summary>What a person is inside one team (category). It can differ from team to team.</summary>
public enum TeamRole
{
    /// <summary>Leads the team: hands out its work and reviews it.</summary>
    Lead = 0,

    /// <summary>Teaches in the team: receives work and hands it in.</summary>
    Mentor = 1,

    /// <summary>
    /// Works in the team without teaching — somebody doing content for an SMM team, say. Receives and
    /// hands in work like a mentor, but is not counted as one.
    /// </summary>
    Member = 2,
}

/// <summary>
/// A person's place in a team beyond the single one stored on their account, or a different title in
/// that one.
/// </summary>
/// <remarks>
/// <para>
/// A lead and a mentor keep their <see cref="User.CategoryId"/> — their main team. Every other team is
/// one row here. An administrator of a branch has no main team, so all of theirs are rows here. A row
/// for a mentor's main team exists only to call them «участник» there instead of «ментор».
/// </para>
/// <para>
/// The row grants nothing outside its team: what a person may do while acting in it is decided by
/// <see cref="Role"/>, and the branch is always the team's own, so no membership crosses a branch.
/// </para>
/// </remarks>
public sealed class TeamMembership : AuditableEntity
{
    public Guid OrganizationId { get; private set; }

    public Guid BranchId { get; private set; }

    public Guid CategoryId { get; private set; }

    public Guid UserId { get; private set; }

    public TeamRole Role { get; private set; }

    public Guid AddedById { get; private set; }

    private TeamMembership()
    {
    }

    public static TeamMembership Create(User user, Guid categoryId, Guid categoryBranchId, TeamRole role, Guid addedById, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(user);

        EnsureAllowed(user, categoryId, categoryBranchId, role);

        var membership = new TeamMembership
        {
            OrganizationId = user.OrganizationId,
            BranchId = categoryBranchId,
            CategoryId = categoryId,
            UserId = user.Id,
            Role = role,
            AddedById = addedById,
            CreatedAt = now,
            UpdatedAt = now,
        };

        return membership;
    }

    public void ChangeRole(User user, TeamRole role, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(user);

        EnsureAllowed(user, CategoryId, BranchId, role);
        Role = role;
        UpdatedAt = now;
    }

    private static void EnsureAllowed(User user, Guid categoryId, Guid categoryBranchId, TeamRole role)
    {
        // An organization administrator stands above every branch and belongs to no team of one.
        if (user.BranchId is not { } branchId || branchId != categoryBranchId)
        {
            throw new DomainException(DomainErrorCodes.CrossScopeReference, "В команду можно добавить только человека из того же филиала.");
        }

        if (user.Role is UserRole.Admin && role is TeamRole.Mentor)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Администратор может быть в команде участником или тимлидом.");
        }

        // The main team's role is the account's own; only «ментор» there may be renamed «участник».
        if (user.CategoryId == categoryId && !(user.Role is UserRole.Mentor && role is TeamRole.Mentor or TeamRole.Member))
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "В основной команде роль меняется через смену роли пользователя.");
        }
    }
}

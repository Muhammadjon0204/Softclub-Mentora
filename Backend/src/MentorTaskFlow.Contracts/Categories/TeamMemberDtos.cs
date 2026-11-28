namespace MentorTaskFlow.Contracts.Categories;

/// <summary>
/// One person of a team (<c>GET /categories/{id}/members</c>).
/// </summary>
/// <remarks>
/// <para>
/// <c>role</c> is what they are in this team — <c>Lead</c>, <c>Mentor</c> or <c>Member</c>;
/// <c>accountRole</c> is their role on the account, which may differ.
/// </para>
/// <para>
/// <c>assignableRoles</c> and <c>canRemove</c> describe what the caller may do with this row, so the
/// page never offers an action the server would refuse.
/// </para>
/// </remarks>
public sealed record TeamMemberDto(
    Guid UserId,
    string FullName,
    string Email,
    string Role,
    string AccountRole,
    bool IsMain,
    bool IsActive,
    IReadOnlyList<string> AssignableRoles,
    bool CanRemove,
    string? AvatarUrl = null);

/// <summary>
/// Somebody of the branch who is not in the team yet and whom the caller may add.
/// </summary>
public sealed record TeamCandidateDto(
    Guid UserId,
    string FullName,
    string AccountRole,
    string? MainTeamName,
    IReadOnlyList<string> AssignableRoles,
    string? AvatarUrl = null);

/// <summary><c>POST /categories/{id}/members</c>. <c>role</c>: <c>Lead</c>, <c>Mentor</c> or <c>Member</c>.</summary>
public sealed record AddTeamMemberRequest(Guid UserId, string Role);

/// <summary><c>PUT /categories/{id}/members/{userId}</c>.</summary>
public sealed record ChangeTeamMemberRoleRequest(string Role);

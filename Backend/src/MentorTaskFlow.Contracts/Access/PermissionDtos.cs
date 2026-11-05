namespace MentorTaskFlow.Contracts.Access;

/// <summary>One role's value for one permission.</summary>
/// <param name="Rule">The organization's own setting; null while the role is on the default.</param>
public sealed record RolePermissionCellDto(string Subject, bool Default, bool? Rule, bool Effective);

public sealed record RolePermissionRowDto(string Key, string Group, IReadOnlyList<RolePermissionCellDto> Cells);

/// <summary><c>PUT /permissions/roles</c>. A null <c>Allowed</c> returns the role to the default.</summary>
public sealed record SetRolePermissionRequest(string Subject, string Permission, bool? Allowed);

/// <summary>One permission of one person.</summary>
/// <param name="RoleValue">What their role gets, which is what clearing the exception returns to.</param>
/// <param name="Override">Their personal exception; null while there is none.</param>
public sealed record UserPermissionRowDto(string Key, string Group, bool RoleValue, bool? Override, bool Effective);

public sealed record UserPermissionsDto(
    Guid UserId,
    string FullName,
    string Role,
    bool CanEdit,
    IReadOnlyList<UserPermissionRowDto> Permissions);

public sealed record UserPermissionChange(string Permission, bool? Allowed);

public sealed record SetUserPermissionsRequest(IReadOnlyList<UserPermissionChange> Changes);

/// <summary>A person whose access differs from their role's, for the overview of exceptions.</summary>
public sealed record PermissionExceptionDto(
    Guid UserId,
    string FullName,
    string Role,
    string? BranchName,
    string? CategoryName,
    IReadOnlyList<string> Allowed,
    IReadOnlyList<string> Denied);

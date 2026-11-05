using MentorTaskFlow.Contracts.Access;
using MentorTaskFlow.Domain.Tenancy;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// What each person may do, and the configuration behind it.
/// </summary>
/// <remarks>
/// Read from the database on every guarded request rather than carried in the token, so a restriction
/// takes effect on the very next call instead of when the access token happens to expire.
/// </remarks>
public interface IPermissionService
{
    /// <summary>Whether the current user holds the permission.</summary>
    Task<bool> HasAsync(string permission, CancellationToken cancellationToken);

    /// <summary>
    /// Everything a person may do, for the interface to hide what would only answer 403.
    /// </summary>
    /// <remarks>Takes the person explicitly: sign-in runs before any request scope exists.</remarks>
    Task<IReadOnlyList<string>> GetEffectiveAsync(
        Guid userId,
        UserRole role,
        AdminScope? adminScope,
        Guid organizationId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<RolePermissionRowDto>> GetRoleMatrixAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<RolePermissionRowDto>> SetRoleRuleAsync(SetRolePermissionRequest request, CancellationToken cancellationToken);

    Task<UserPermissionsDto> GetForUserAsync(Guid userId, CancellationToken cancellationToken);

    Task<UserPermissionsDto> SetForUserAsync(Guid userId, SetUserPermissionsRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<PermissionExceptionDto>> ListExceptionsAsync(CancellationToken cancellationToken);
}

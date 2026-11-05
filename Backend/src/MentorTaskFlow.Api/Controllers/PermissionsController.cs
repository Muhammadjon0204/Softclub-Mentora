using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Access;
using MentorTaskFlow.Domain.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// Who may do what: the rule for each role, and exceptions for individual people.
/// </summary>
/// <remarks>
/// A role's rule binds the whole organization, so only an Organization Admin sets it. A Branch Admin
/// sees it and sets exceptions for the Leads and Mentors of their own branch.
/// </remarks>
[ApiController]
[Route("api/v1/permissions")]
[Produces("application/json")]
[RequirePermission(Permissions.PermissionsManage)]
public sealed class PermissionsController(IPermissionService permissionService) : ControllerBase
{
    [HttpGet("roles")]
    [Authorize(Policy = MtfPolicies.AnyAdmin)]
    [ProducesResponseType<IReadOnlyList<RolePermissionRowDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RolePermissionRowDto>>> GetRolesAsync(CancellationToken cancellationToken) =>
        Ok(await permissionService.GetRoleMatrixAsync(cancellationToken));

    [HttpPut("roles")]
    [Authorize(Policy = MtfPolicies.OrganizationAdmin)]
    [ProducesResponseType<IReadOnlyList<RolePermissionRowDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RolePermissionRowDto>>> SetRoleAsync(
        SetRolePermissionRequest request,
        CancellationToken cancellationToken) =>
        Ok(await permissionService.SetRoleRuleAsync(request, cancellationToken));

    [HttpGet("exceptions")]
    [Authorize(Policy = MtfPolicies.AnyAdmin)]
    [ProducesResponseType<IReadOnlyList<PermissionExceptionDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PermissionExceptionDto>>> GetExceptionsAsync(CancellationToken cancellationToken) =>
        Ok(await permissionService.ListExceptionsAsync(cancellationToken));

    [HttpGet("users/{id:guid}")]
    [Authorize(Policy = MtfPolicies.AnyAdmin)]
    [ProducesResponseType<UserPermissionsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserPermissionsDto>> GetUserAsync(Guid id, CancellationToken cancellationToken) =>
        Ok(await permissionService.GetForUserAsync(id, cancellationToken));

    [HttpPut("users/{id:guid}")]
    [Authorize(Policy = MtfPolicies.AnyAdmin)]
    [ProducesResponseType<UserPermissionsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserPermissionsDto>> SetUserAsync(
        Guid id,
        SetUserPermissionsRequest request,
        CancellationToken cancellationToken) =>
        Ok(await permissionService.SetForUserAsync(id, request, cancellationToken));
}

using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MentorTaskFlow.Api.Authorization;

/// <summary>
/// Requires a permission of the catalog on top of the endpoint's policy.
/// </summary>
/// <remarks>
/// The policy still answers «may this role act at all» (<c>SEC-001</c>). This answers the question an
/// administrator can now change: may this person. It never widens anything, because it runs only
/// after the policy has let the request through.
/// </remarks>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequirePermissionAttribute(string permission) : Attribute, IAsyncAuthorizationFilter
{
    public string Permission { get; } = permission;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var permissions = context.HttpContext.RequestServices.GetRequiredService<IPermissionService>();

        if (!await permissions.HasAsync(Permission, context.HttpContext.RequestAborted))
        {
            throw new ForbiddenException(ErrorCodes.PermissionDenied, "Администратор ограничил вам это действие.");
        }
    }
}

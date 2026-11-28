using System.Security.Claims;
using MentorTaskFlow.Api.Options;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Contracts.Common;

namespace MentorTaskFlow.Api.Middleware;

/// <summary>
/// Lets a person who belongs to several teams act in one of them: <c>X-MTF-Team-Id</c> names the team,
/// and for this request they are its lead or its executor, scoped to it — nothing else.
/// </summary>
/// <remarks>
/// <para>
/// The header only chooses among seats the database already gives the person; naming any other team is
/// a 403. Without the header nothing changes: they are who their account says.
/// </para>
/// <para>
/// Runs between authentication and authorization, replacing the role and scope claims, so that every
/// policy, permission and query downstream sees one consistent identity and none of them needs to know
/// that teams can be plural.
/// </para>
/// </remarks>
public sealed class TeamContextMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITeamContextResolver resolver)
    {
        if (!context.Request.Headers.TryGetValue(TenancyOptions.TeamHeaderName, out var raw)
            || context.User.Identity is not { IsAuthenticated: true })
        {
            await next(context);
            return;
        }

        var principal = context.User;

        if (!Guid.TryParse(raw.ToString(), out var teamId)
            || !Guid.TryParse(principal.FindFirstValue(MtfClaimTypes.Subject), out var userId)
            || !Guid.TryParse(principal.FindFirstValue(MtfClaimTypes.OrganizationId), out var organizationId)
            || await resolver.ResolveAsync(userId, organizationId, teamId, context.RequestAborted) is not { } seat)
        {
            throw new ForbiddenException(ErrorCodes.ScopeOverrideForbidden, "Вы не состоите в этой команде.");
        }

        var current = (ClaimsIdentity)principal.Identity!;
        var identity = new ClaimsIdentity(
            current.Claims.Where(c => c.Type is not (MtfClaimTypes.Role or MtfClaimTypes.AdminScope or MtfClaimTypes.BranchId or MtfClaimTypes.CategoryId)),
            current.AuthenticationType,
            current.NameClaimType,
            current.RoleClaimType);
        identity.AddClaim(new Claim(MtfClaimTypes.Role, seat.Role.ToString()));
        identity.AddClaim(new Claim(MtfClaimTypes.BranchId, seat.BranchId.ToString()));
        identity.AddClaim(new Claim(MtfClaimTypes.CategoryId, teamId.ToString()));
        context.User = new ClaimsPrincipal(identity);

        await next(context);
    }
}

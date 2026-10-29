using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Integrations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// Omuz CRM integration, read-only.
/// </summary>
/// <remarks>
/// The CRM key reads every branch, so isolation is RAVAND's: the groups and journals are open to every
/// role, each within its scope (<see cref="ICrmIntegrationService.GetAccessAsync"/>) — a mentor their
/// own groups, a Lead their team's, a Branch Admin their branch's. The connection status and the links
/// that decide those scopes are the Organization Admin's alone.
/// </remarks>
[ApiController]
[Route("api/v1/integrations/crm")]
[Produces("application/json")]
[Authorize(Policy = MtfPolicies.Authenticated)]
public sealed class CrmIntegrationController(ICrmIntegrationService crm, ICrmLinkService links) : ControllerBase
{
    /// <summary><c>GET /integrations/crm/status</c> — connection, key name, latency, branches and courses.</summary>
    [HttpGet("status")]
    [Authorize(Policy = MtfPolicies.OrganizationAdmin)]
    [ProducesResponseType<CrmStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmStatusDto>> StatusAsync(CancellationToken cancellationToken) =>
        Ok(await crm.GetStatusAsync(cancellationToken));

    /// <summary><c>GET /integrations/crm/access</c> — what the caller sees and, if nothing, why.</summary>
    [HttpGet("access")]
    [ProducesResponseType<CrmAccessDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmAccessDto>> AccessAsync(CancellationToken cancellationToken) =>
        Ok(await crm.GetAccessAsync(cancellationToken));

    /// <summary><c>GET /integrations/crm/groups?status=Started</c> — the caller's groups.</summary>
    [HttpGet("groups")]
    [ProducesResponseType<CrmGroupListDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmGroupListDto>> GroupsAsync([FromQuery] string status = "Started", CancellationToken cancellationToken = default) =>
        Ok(await crm.ListGroupsAsync(status, cancellationToken));

    /// <summary><c>GET /integrations/crm/groups/{id}</c> — the group with its journal scored by week.</summary>
    [HttpGet("groups/{groupId:int}")]
    [ProducesResponseType<CrmGroupPreviewDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CrmGroupPreviewDto>> GroupAsync(int groupId, CancellationToken cancellationToken) =>
        Ok(await crm.GetGroupPreviewAsync(groupId, cancellationToken));

    /// <summary><c>GET /integrations/crm/links</c> — CRM mentors and branches with their RAVAND counterparts.</summary>
    [HttpGet("links")]
    [Authorize(Policy = MtfPolicies.OrganizationAdmin)]
    [ProducesResponseType<CrmLinksDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmLinksDto>> LinksAsync(CancellationToken cancellationToken) =>
        Ok(await links.GetLinksAsync(cancellationToken));

    /// <summary><c>PUT /integrations/crm/links/mentors/{crmMentorId}</c> — link or unlink a RAVAND account.</summary>
    [HttpPut("links/mentors/{crmMentorId:int}")]
    [Authorize(Policy = MtfPolicies.OrganizationAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> LinkMentorAsync(int crmMentorId, [FromBody] CrmLinkMentorRequest request, CancellationToken cancellationToken)
    {
        await links.LinkMentorAsync(crmMentorId, request.UserId, cancellationToken);
        return NoContent();
    }

    /// <summary><c>PUT /integrations/crm/links/branches/{crmBranchId}</c> — link or unlink a RAVAND branch.</summary>
    [HttpPut("links/branches/{crmBranchId:int}")]
    [Authorize(Policy = MtfPolicies.OrganizationAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> LinkBranchAsync(int crmBranchId, [FromBody] CrmLinkBranchRequest request, CancellationToken cancellationToken)
    {
        await links.LinkBranchAsync(crmBranchId, request.BranchId, cancellationToken);
        return NoContent();
    }
}

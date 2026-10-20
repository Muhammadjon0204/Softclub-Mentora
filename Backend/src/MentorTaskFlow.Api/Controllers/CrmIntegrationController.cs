using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Integrations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// Omuz CRM integration, read-only — for the Organization Admin, because the CRM key reads every
/// branch and so does this view.
/// </summary>
[ApiController]
[Route("api/v1/integrations/crm")]
[Produces("application/json")]
[Authorize(Policy = MtfPolicies.OrganizationAdmin)]
public sealed class CrmIntegrationController(ICrmIntegrationService crm) : ControllerBase
{
    /// <summary><c>GET /integrations/crm/status</c> — connection, key name, latency, branches and courses.</summary>
    [HttpGet("status")]
    [ProducesResponseType<CrmStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmStatusDto>> StatusAsync(CancellationToken cancellationToken) =>
        Ok(await crm.GetStatusAsync(cancellationToken));

    /// <summary><c>GET /integrations/crm/groups?status=Started</c>.</summary>
    [HttpGet("groups")]
    [ProducesResponseType<CrmGroupListDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmGroupListDto>> GroupsAsync([FromQuery] string status = "Started", CancellationToken cancellationToken = default) =>
        Ok(await crm.ListGroupsAsync(status, cancellationToken));

    /// <summary><c>GET /integrations/crm/groups/{id}</c> — the group with its journal scored by week.</summary>
    [HttpGet("groups/{groupId:int}")]
    [ProducesResponseType<CrmGroupPreviewDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmGroupPreviewDto>> GroupAsync(int groupId, CancellationToken cancellationToken) =>
        Ok(await crm.GetGroupPreviewAsync(groupId, cancellationToken));
}

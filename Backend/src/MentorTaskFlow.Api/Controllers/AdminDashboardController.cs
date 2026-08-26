using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Admin.Dashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// The Admin Dashboard overview screen (Phase 1 product extensions).
/// </summary>
/// <remarks>
/// Either administrative contour may call this — the reach difference between an Organization Admin
/// and a Branch Admin is expressed by <see cref="MentorTaskFlow.Application.Common.Tenancy.IBranchContext"/>,
/// not by a narrower policy, exactly as it already is for Categories and Branches.
/// </remarks>
[ApiController]
[Route("api/v1/admin/dashboard")]
[Produces("application/json")]
public sealed class AdminDashboardController(IAdminDashboardService dashboardService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = MtfPolicies.AnyAdmin)]
    [ProducesResponseType<DashboardResponseDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardResponseDto>> GetAsync(
        [FromQuery] DashboardQuery query,
        CancellationToken cancellationToken) =>
        Ok(await dashboardService.GetAsync(query, cancellationToken));
}

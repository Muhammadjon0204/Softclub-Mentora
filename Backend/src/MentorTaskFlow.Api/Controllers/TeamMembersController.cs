using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Categories;
using MentorTaskFlow.Domain.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// The people of a team, including those whose main team is another one.
/// </summary>
/// <remarks>
/// A team is a category. Which teams the caller may manage, and which roles they may give, is decided
/// per request by <see cref="ITeamMemberService"/>; the policy only keeps executors out.
/// </remarks>
[ApiController]
[Route("api/v1/categories/{categoryId:guid}")]
[Produces("application/json")]
[Authorize(Policy = MtfPolicies.LeadOrAdmin)]
public sealed class TeamMembersController(ITeamMemberService members) : ControllerBase
{
    [HttpGet("members")]
    [ProducesResponseType<IReadOnlyList<TeamMemberDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<TeamMemberDto>>> ListAsync(
        Guid categoryId,
        CancellationToken cancellationToken) =>
        Ok(await members.ListAsync(categoryId, cancellationToken));

    [HttpGet("member-candidates")]
    [RequirePermission(Permissions.UsersManage)]
    [ProducesResponseType<IReadOnlyList<TeamCandidateDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<TeamCandidateDto>>> ListCandidatesAsync(
        Guid categoryId,
        [FromQuery] string? search,
        CancellationToken cancellationToken) =>
        Ok(await members.ListCandidatesAsync(categoryId, search, cancellationToken));

    [HttpPost("members")]
    [RequirePermission(Permissions.UsersManage)]
    [ProducesResponseType<TeamMemberDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TeamMemberDto>> AddAsync(
        Guid categoryId,
        AddTeamMemberRequest request,
        CancellationToken cancellationToken) =>
        Ok(await members.AddAsync(categoryId, request, cancellationToken));

    [HttpPut("members/{userId:guid}")]
    [RequirePermission(Permissions.UsersManage)]
    [ProducesResponseType<TeamMemberDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<TeamMemberDto>> ChangeRoleAsync(
        Guid categoryId,
        Guid userId,
        ChangeTeamMemberRoleRequest request,
        CancellationToken cancellationToken) =>
        Ok(await members.ChangeRoleAsync(categoryId, userId, request, cancellationToken));

    [HttpDelete("members/{userId:guid}")]
    [RequirePermission(Permissions.UsersManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RemoveAsync(Guid categoryId, Guid userId, CancellationToken cancellationToken)
    {
        await members.RemoveAsync(categoryId, userId, cancellationToken);

        return NoContent();
    }
}

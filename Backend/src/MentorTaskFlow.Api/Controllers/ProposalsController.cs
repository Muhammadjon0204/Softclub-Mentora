using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Proposals;
using MentorTaskFlow.Domain.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// Mentors' own ideas: a master class, extra lessons, anything they want to take on.
/// </summary>
/// <remarks>
/// An approval creates an ordinary assignment for the author, so everything after it — the deadline,
/// the hand-in, the review — is the assignment lifecycle and not a second one.
/// </remarks>
[ApiController]
[Route("api/v1/proposals")]
[Produces("application/json")]
public sealed class ProposalsController(IProposalService proposalService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<PagedResult<ProposalDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ProposalDto>>> ListAsync(
        [FromQuery] ProposalListQuery query,
        CancellationToken cancellationToken) =>
        Ok(await proposalService.ListAsync(query, cancellationToken));

    [HttpGet("{id:guid}", Name = RouteNames.GetProposal)]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<ProposalDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProposalDto>> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Ok(await proposalService.GetAsync(id, cancellationToken));

    [HttpPost]
    [Authorize(Policy = MtfPolicies.Mentor)]
    [RequirePermission(Permissions.ProposalsCreate)]
    [ProducesResponseType<ProposalDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<ProposalDto>> CreateAsync(
        CreateProposalRequest request,
        CancellationToken cancellationToken)
    {
        var proposal = await proposalService.CreateAsync(request, cancellationToken);

        return CreatedAtRoute(RouteNames.GetProposal, new { id = proposal.Id }, proposal);
    }

    /// <summary><c>PUT /proposals/{id}</c> — the author, while nobody has decided yet.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = MtfPolicies.Mentor)]
    [RequirePermission(Permissions.ProposalsCreate)]
    [ProducesResponseType<ProposalDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProposalDto>> UpdateAsync(
        Guid id,
        UpdateProposalRequest request,
        CancellationToken cancellationToken) =>
        Ok(await proposalService.UpdateAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/withdraw")]
    [Authorize(Policy = MtfPolicies.Mentor)]
    [ProducesResponseType<ProposalDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProposalDto>> WithdrawAsync(
        Guid id,
        ProposalActionRequest request,
        CancellationToken cancellationToken) =>
        Ok(await proposalService.WithdrawAsync(id, request, cancellationToken));

    /// <summary>
    /// <c>POST /proposals/{id}/approve</c> — the assignment appears for the author with the given
    /// deadline, in the same transaction that closes the proposal.
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.ProposalsDecide)]
    [ProducesResponseType<ProposalDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProposalDto>> ApproveAsync(
        Guid id,
        ApproveProposalRequest request,
        CancellationToken cancellationToken) =>
        Ok(await proposalService.ApproveAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.ProposalsDecide)]
    [ProducesResponseType<ProposalDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProposalDto>> RejectAsync(
        Guid id,
        RejectProposalRequest request,
        CancellationToken cancellationToken) =>
        Ok(await proposalService.RejectAsync(id, request, cancellationToken));
}

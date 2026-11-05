using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Assignments;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Domain.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// The assignment lifecycle (Приложение D.5, TZ 13, 15.5).
/// </summary>
/// <remarks>
/// <para>
/// Work is led by whoever handed it out, a Lead or an administrator, and the policies below only say
/// who can hand work out at all. Each service call then requires the caller to own that very task
/// (<c>AssignmentOwnership</c>). This replaces <c>ASN-025</c>, which kept administrators out of the
/// study cycle: anybody above the owner still only watches, except for the force-cancel.
/// </para>
/// <para>
/// State changes never travel through <c>PUT</c> or <c>PATCH</c> of a <c>status</c> field — only
/// through the named actions below, each of which returns the whole updated object so the client has
/// the new status and the new <c>concurrencyToken</c> without a second request (<c>API-008</c>,
/// <c>API-010</c>).
/// </para>
/// </remarks>
[ApiController]
[Route("api/v1/assignments")]
[Produces("application/json")]
public sealed class AssignmentsController(IAssignmentService assignmentService) : ControllerBase
{
    /// <summary><c>GET /assignments</c> — scoped to what the caller may see.</summary>
    [HttpGet]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<PagedResult<AssignmentDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AssignmentDto>>> ListAsync(
        [FromQuery] AssignmentListQuery query,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.ListAsync(query, cancellationToken));

    [HttpGet("{id:guid}", Name = RouteNames.GetAssignment)]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AssignmentDto>> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Ok(await assignmentService.GetAsync(id, cancellationToken));

    /// <summary>
    /// <c>GET /assignments/{id}/history</c> — the events in sequence order (<c>ASN-009</c>).
    /// </summary>
    /// <remarks>
    /// A Mentor sees the role of whoever acted rather than their identity, so the history explains
    /// what happened to their task without naming other people (<c>EVT-004</c>).
    /// </remarks>
    [HttpGet("{id:guid}/history")]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<IReadOnlyList<TaskEventDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TaskEventDto>>> GetHistoryAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.GetHistoryAsync(id, cancellationToken));

    /// <summary>
    /// <c>POST /assignments/drafts</c> — creates an unpublished draft (<c>ASN-001</c>).
    /// </summary>
    /// <remarks>
    /// A draft is visible to the Lead and Admin only, sends no notification and counts in no metric.
    /// It becomes real work at <c>publish</c>. An administrator's draft lands in the assignee's branch
    /// and category, which is how «anyone below them» works without a scope field in the request.
    /// </remarks>
    [HttpPost("drafts")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.AssignmentsAssign)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AssignmentDto>> CreateDraftAsync(
        CreateAssignmentDraftRequest request,
        CancellationToken cancellationToken)
    {
        var assignment = await assignmentService.CreateDraftAsync(request, cancellationToken);

        return CreatedAtRoute(RouteNames.GetAssignment, new { id = assignment.Id }, assignment);
    }

    /// <summary>
    /// <c>PUT /assignments/{id}</c> — permitted in <c>Draft</c> and <c>Suggested</c> only
    /// (<c>ASN-004</c>).
    /// </summary>
    /// <remarks>
    /// Once published, the title and description are the terms the Mentor was given, and editing them
    /// would rewrite work already under way. Anything else answers 409. The deadline alone can still
    /// move, through <c>reschedule</c>.
    /// </remarks>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.AssignmentsAssign)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AssignmentDto>> UpdateAsync(
        Guid id,
        UpdateAssignmentRequest request,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.UpdateAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/publish")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.AssignmentsAssign)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AssignmentDto>> PublishAsync(
        Guid id,
        AssignmentActionRequest request,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.PublishAsync(id, request, cancellationToken));

    /// <summary><c>POST /assignments/{id}/accept-suggestion</c> (<c>ASN-003</c>, <c>ASN-010</c>).</summary>
    [HttpPost("{id:guid}/accept-suggestion")]
    [Authorize(Policy = MtfPolicies.Lead)]
    [RequirePermission(Permissions.AssignmentsAssign)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<AssignmentDto>> AcceptSuggestionAsync(
        Guid id,
        AssignmentActionRequest request,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.AcceptSuggestionAsync(id, request, cancellationToken));

    /// <summary>
    /// <c>POST /assignments/{id}/reassign</c> — only until the first submission (10.6.3).
    /// </summary>
    [HttpPost("{id:guid}/reassign")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.AssignmentsReassign)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AssignmentDto>> ReassignAsync(
        Guid id,
        ReassignAssignmentRequest request,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.ReassignAsync(id, request, cancellationToken));

    /// <summary>
    /// <c>POST /assignments/{id}/reschedule</c> — moves the deadline while the work is with its executor.
    /// </summary>
    /// <remarks>
    /// Always with a reason, which reaches the executor and stays in the task's history. From
    /// <c>Overdue</c> the task returns to where it slipped from; the fact that it slipped stays on record.
    /// </remarks>
    [HttpPost("{id:guid}/reschedule")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.AssignmentsReschedule)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AssignmentDto>> RescheduleAsync(
        Guid id,
        RescheduleAssignmentRequest request,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.RescheduleAsync(id, request, cancellationToken));

    /// <summary>
    /// <c>POST /assignments/{id}/start-review</c> (<c>REV-001</c>).
    /// </summary>
    /// <remarks>
    /// The only way into <c>InReview</c>. It is never entered by opening a page or downloading the
    /// file, because <c>FirstReviewResponseTime</c> measures the queueing time this action ends
    /// (<c>API-013</c>).
    /// </remarks>
    [HttpPost("{id:guid}/start-review")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.AssignmentsReview)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AssignmentDto>> StartReviewAsync(
        Guid id,
        AssignmentActionRequest request,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.StartReviewAsync(id, request, cancellationToken));

    /// <summary>
    /// <c>POST /assignments/{id}/cancel</c> — the owner of the task, or an administrator as a
    /// force-cancel (<c>ASN-006</c>).
    /// </summary>
    /// <remarks>
    /// Available from any non-terminal status and always with a reason. Existing submissions, reviews
    /// and events survive: they are the record of what happened before the work was stopped
    /// (<c>ASN-024</c>).
    /// </remarks>
    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = MtfPolicies.LeadOrAdmin)]
    [RequirePermission(Permissions.AssignmentsCancel)]
    [ProducesResponseType<AssignmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AssignmentDto>> CancelAsync(
        Guid id,
        CancelAssignmentRequest request,
        CancellationToken cancellationToken) =>
        Ok(await assignmentService.CancelAsync(id, request, cancellationToken));
}

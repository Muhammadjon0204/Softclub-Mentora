using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Journal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// <c>GET /journal</c> — the task journal of whoever asks: everything that happened to the tasks they
/// can see, who did it, and what was before and after.
/// </summary>
/// <remarks>
/// Open to every role; the scope is the caller's own (organization, branch, team, own tasks), decided
/// in <see cref="IJournalService"/>. The administrative audit log stays separate (<c>/admin/audit-log</c>):
/// it covers accounts, branches and settings, which are not task history.
/// </remarks>
[ApiController]
[Route("api/v1/journal")]
[Produces("application/json")]
[Authorize(Policy = MtfPolicies.Authenticated)]
public sealed class JournalController(IJournalService journal) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<PagedResult<JournalEntryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<JournalEntryDto>>> GetAsync(
        [FromQuery] JournalQuery query,
        CancellationToken cancellationToken) =>
        Ok(await journal.ListAsync(query, cancellationToken));
}

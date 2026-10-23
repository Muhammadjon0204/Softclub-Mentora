using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Integrations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// Mentors' weekly reports on their CRM groups.
/// </summary>
/// <remarks>
/// Every role reaches these endpoints; what each sees is decided by the CRM scope and by
/// <see cref="ICrmReportService"/>: the author works on a draft, the author's Lead, Branch Admin and the
/// Organization Admin read what was sent.
/// </remarks>
[ApiController]
[Route("api/v1/integrations/crm")]
[Produces("application/json")]
[Authorize(Policy = MtfPolicies.Authenticated)]
public sealed class CrmReportsController(ICrmReportService reports) : ControllerBase
{
    /// <summary><c>GET …/groups/{id}/weeks/{week}/report</c> — the period's report, or whether the caller can make it.</summary>
    [HttpGet("groups/{groupId:int}/weeks/{week:int}/report")]
    [ProducesResponseType<CrmReportStateDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CrmReportStateDto>> GetAsync(int groupId, int week, CancellationToken cancellationToken) =>
        Ok(await reports.GetAsync(groupId, week, cancellationToken));

    /// <summary><c>POST …/report</c> — makes the draft; the AI drafts the conclusions when it is configured.</summary>
    [HttpPost("groups/{groupId:int}/weeks/{week:int}/report")]
    [ProducesResponseType<CrmReportStateDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CrmReportStateDto>> CreateAsync(int groupId, int week, CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created, await reports.CreateAsync(groupId, week, cancellationToken));

    /// <summary><c>PUT …/report</c> — saves the mentor's text.</summary>
    [HttpPut("groups/{groupId:int}/weeks/{week:int}/report")]
    [ProducesResponseType<CrmReportStateDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmReportStateDto>> SaveAsync(int groupId, int week, [FromBody] CrmReportConclusionsRequest request, CancellationToken cancellationToken) =>
        Ok(await reports.SaveAsync(groupId, week, request.Conclusions, cancellationToken));

    /// <summary><c>POST …/report/redraft</c> — a new AI draft of the conclusions.</summary>
    [HttpPost("groups/{groupId:int}/weeks/{week:int}/report/redraft")]
    [ProducesResponseType<CrmReportStateDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<CrmReportStateDto>> RedraftAsync(int groupId, int week, CancellationToken cancellationToken) =>
        Ok(await reports.RedraftAsync(groupId, week, cancellationToken));

    /// <summary><c>POST …/report/refresh</c> — takes the figures as the CRM has them now.</summary>
    [HttpPost("groups/{groupId:int}/weeks/{week:int}/report/refresh")]
    [ProducesResponseType<CrmReportStateDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmReportStateDto>> RefreshAsync(int groupId, int week, CancellationToken cancellationToken) =>
        Ok(await reports.RefreshAsync(groupId, week, cancellationToken));

    /// <summary><c>POST …/report/send</c> — sends the report to the Lead; it is read-only after that.</summary>
    [HttpPost("groups/{groupId:int}/weeks/{week:int}/report/send")]
    [ProducesResponseType<CrmReportStateDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmReportStateDto>> SendAsync(int groupId, int week, CancellationToken cancellationToken) =>
        Ok(await reports.SendAsync(groupId, week, cancellationToken));

    /// <summary><c>GET /integrations/crm/reports</c> — the reports the caller may read.</summary>
    [HttpGet("reports")]
    [ProducesResponseType<CrmReportListDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CrmReportListDto>> ListAsync(CancellationToken cancellationToken) =>
        Ok(await reports.ListAsync(cancellationToken));

    /// <summary><c>GET /integrations/crm/reports/{id}/pdf</c> — the report as an A4 PDF.</summary>
    [HttpGet("reports/{id:guid}/pdf")]
    [Produces("application/pdf")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PdfAsync(Guid id, CancellationToken cancellationToken)
    {
        var file = await reports.GetPdfAsync(id, cancellationToken);
        return File(file.Content, file.ContentType, file.FileName);
    }

    /// <summary><c>GET /integrations/crm/reports/{id}</c>.</summary>
    [HttpGet("reports/{id:guid}")]
    [ProducesResponseType<CrmGroupReportDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CrmGroupReportDto>> ReportAsync(Guid id, CancellationToken cancellationToken) =>
        Ok(await reports.GetByIdAsync(id, cancellationToken));
}

using MentorTaskFlow.Contracts.Integrations;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// Mentors' weekly reports on their CRM groups: the CRM's figures scored by RAVAND, the AI's draft of
/// the conclusions, the mentor's edit, and the report sent to the Lead.
/// </summary>
/// <remarks>
/// A group the caller cannot see in the CRM is «not found» here too. A draft is the author's alone;
/// a sent report is read by the author's Lead, Branch Admin and the Organization Admin.
/// </remarks>
public interface ICrmReportService
{
    Task<CrmReportStateDto> GetAsync(int groupId, int week, CancellationToken cancellationToken);

    /// <summary>Makes the draft from the period's figures; the AI drafts the conclusions when it can.</summary>
    Task<CrmReportStateDto> CreateAsync(int groupId, int week, CancellationToken cancellationToken);

    Task<CrmReportStateDto> SaveAsync(int groupId, int week, string conclusions, CancellationToken cancellationToken);

    /// <summary>Asks the AI for a new draft of the conclusions, replacing the current text.</summary>
    Task<CrmReportStateDto> RedraftAsync(int groupId, int week, CancellationToken cancellationToken);

    /// <summary>Takes the figures as the CRM has them now, after a correction.</summary>
    Task<CrmReportStateDto> RefreshAsync(int groupId, int week, CancellationToken cancellationToken);

    Task<CrmReportStateDto> SendAsync(int groupId, int week, CancellationToken cancellationToken);

    /// <summary>The reports the caller may read: their own, and the sent ones of their scope.</summary>
    Task<CrmReportListDto> ListAsync(CancellationToken cancellationToken);

    Task<CrmGroupReportDto> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The report as a PDF, for whoever may read it.</summary>
    Task<ReportFile> GetPdfAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>A generated document: its file name, media type and bytes.</summary>
public sealed record ReportFile(string FileName, string ContentType, byte[] Content);

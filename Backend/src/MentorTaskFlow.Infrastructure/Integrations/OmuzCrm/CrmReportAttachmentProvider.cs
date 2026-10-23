using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <summary>
/// The PDF of the report a «report sent» notification is about — for the Lead and for the author.
/// </summary>
/// <remarks>
/// Runs in the delivery worker, which has no request scope, so the report is read past the tenant
/// filter by its id: the outbox row was addressed by the service that sent the report, inside scope.
/// A report that cannot be rendered never blocks the notice itself — the text goes without the file.
/// </remarks>
public sealed class CrmReportAttachmentProvider(
    MentorTaskFlowDbContext dbContext,
    ILogger<CrmReportAttachmentProvider> logger) : INotificationAttachmentProvider
{
    public async Task<ReportFile?> GetAsync(string eventType, JsonDocument payload, CancellationToken cancellationToken)
    {
        if (eventType is not (NotificationEventTypes.CrmReportSent or NotificationEventTypes.CrmReportReceipt)
            || !payload.RootElement.TryGetProperty("reportId", out var idElement)
            || !Guid.TryParse(idElement.GetString(), out var reportId))
        {
            return null;
        }

        try
        {
            var report = await dbContext.CrmGroupReports.IgnoreQueryFilters().AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == reportId, cancellationToken);
            if (report is null)
            {
                return null;
            }

            var author = await dbContext.Users.IgnoreQueryFilters().AsNoTracking()
                .Where(u => u.Id == report.AuthorId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(cancellationToken) ?? "—";

            return CrmReportService.Pdf(report, author);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "PDF of CRM report {ReportId} could not be rendered; the notice goes without it.", reportId);
            return null;
        }
    }
}

using System.Text.Json;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// A file that goes with a notification — the PDF of a group report sent to the Lead, say.
/// </summary>
/// <remarks>
/// Made at delivery time from what the payload points to, never stored in the outbox: a row carries
/// a reference, not a document, and a retry renders the current file again.
/// </remarks>
public interface INotificationAttachmentProvider
{
    /// <summary>The attachment of this notification, or null when it has none.</summary>
    Task<ReportFile?> GetAsync(string eventType, JsonDocument payload, CancellationToken cancellationToken);
}

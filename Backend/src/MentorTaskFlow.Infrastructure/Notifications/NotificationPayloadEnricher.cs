using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Notifications;

/// <summary>
/// Adds to an assignment notification what makes it actionable: who did it, when, by when, and a link
/// to that very task for this recipient.
/// </summary>
/// <remarks>
/// <para>
/// Done once here, at enqueue, rather than at every call site that raises an assignment event — six
/// services and jobs would otherwise each have to remember the same five fields.
/// </para>
/// <para>
/// Everything added stays within <c>NTF-017</c>: no token, no presigned URL. <c>actionPath</c> is a
/// relative path into the application, where access is checked again; the mentor's name goes only to
/// their own Lead, who sees it in the application anyway. Times are formatted here, in the category's
/// time zone, because a reader in a chat has no other way to know which zone a bare instant meant
/// (<c>UX-001</c>).
/// </para>
/// </remarks>
internal static class NotificationPayloadEnricher
{
    private static readonly HashSet<string> AssignmentEvents = new(StringComparer.Ordinal)
    {
        NotificationEventTypes.AssignmentAssigned,
        NotificationEventTypes.AssignmentSuggested,
        NotificationEventTypes.AssignmentReassigned,
        NotificationEventTypes.SubmissionUploaded,
        NotificationEventTypes.LateSubmissionUploaded,
        NotificationEventTypes.ReviewApproved,
        NotificationEventTypes.ReviewNeedsRework,
        NotificationEventTypes.DeadlineReminder,
        NotificationEventTypes.AssignmentOverdue,
        NotificationEventTypes.AssignmentCancelled,
    };

    private static readonly HashSet<string> SubmissionEvents = new(StringComparer.Ordinal)
    {
        NotificationEventTypes.SubmissionUploaded,
        NotificationEventTypes.LateSubmissionUploaded,
    };

    public static async Task<JsonDocument> EnrichAsync(
        MentorTaskFlowDbContext dbContext,
        OutboxEntry entry,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (!AssignmentEvents.Contains(entry.EventType))
        {
            return entry.Payload;
        }

        // The change tracker first: a suggestion is enqueued in the same unit of work that creates its
        // assignment, so the row is not in the database yet.
        var assignment = dbContext.Assignments.Local.FirstOrDefault(a => a.Id == entry.EntityId) is { } local
            ? new { local.AssignedToId, local.CategoryId }
            : await dbContext.Assignments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(a => a.Id == entry.EntityId)
                .Select(a => new { a.AssignedToId, a.CategoryId })
                .FirstOrDefaultAsync(cancellationToken);

        if (assignment is null)
        {
            return entry.Payload;
        }

        var people = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == entry.RecipientUserId || u.Id == assignment.AssignedToId)
            .Select(u => new { u.Id, u.Role, u.FullName })
            .ToListAsync(cancellationToken);

        var recipientRole = people.FirstOrDefault(p => p.Id == entry.RecipientUserId)?.Role;
        var assigneeName = people.FirstOrDefault(p => p.Id == assignment.AssignedToId)?.FullName;
        var timeZone = await TimeZoneOfAsync(dbContext, assignment.CategoryId, cancellationToken);

        var payload = JsonNode.Parse(entry.Payload.RootElement.GetRawText())?.AsObject() ?? [];

        payload["assignmentId"] = entry.EntityId.ToString();
        payload["actionPath"] = ActionPath(entry.EventType, recipientRole, entry.EntityId);

        if (payload["currentDueAt"] is JsonValue dueValue && dueValue.TryGetValue<DateTimeOffset>(out var dueAt))
        {
            payload["dueAtLocal"] = Format(dueAt, timeZone);
        }

        // The person the task belongs to, named for whoever supervises it — never for the mentor, who
        // would only be reading their own name.
        if (recipientRole is UserRole.Lead or UserRole.Admin && assigneeName is not null)
        {
            payload["mentorFullName"] = assigneeName;
        }

        if (SubmissionEvents.Contains(entry.EventType))
        {
            payload["submittedAtLocal"] = Format(now, timeZone);
        }

        return JsonSerializer.SerializeToDocument(payload);
    }

    /// <summary>The page this recipient acts on — the review queue for a Lead with work waiting.</summary>
    private static string ActionPath(string eventType, UserRole? recipientRole, Guid assignmentId) => recipientRole switch
    {
        UserRole.Lead when SubmissionEvents.Contains(eventType) => $"/lead/review-queue?assignmentId={assignmentId}",
        UserRole.Lead => $"/lead/assignments?assignmentId={assignmentId}",
        UserRole.Mentor => $"/mentor/tasks?assignmentId={assignmentId}",
        _ => "/admin/assignments",
    };

    private static async Task<TimeZoneInfo> TimeZoneOfAsync(
        MentorTaskFlowDbContext dbContext,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var id = await dbContext.CategorySettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.CategoryId == categoryId)
            .Select(s => s.TimeZoneId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? CategorySettings.FallbackTimeZoneId;

        return TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone)
            ? zone
            : TimeZoneInfo.FindSystemTimeZoneById(CategorySettings.FallbackTimeZoneId);
    }

    private static string Format(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString("dd.MM.yyyy, HH:mm", CultureInfo.InvariantCulture);
}

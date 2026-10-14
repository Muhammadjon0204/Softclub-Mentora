namespace MentorTaskFlow.Domain.Notifications;

/// <summary>
/// The groups a person can switch on and off per channel on their profile page.
/// </summary>
public enum NotificationTopic
{
    /// <summary>New, suggested, reassigned and cancelled assignments.</summary>
    Assignments = 0,

    /// <summary>Deadline reminders and overdue notices.</summary>
    Deadlines = 1,

    /// <summary>Hand-ins, receipts and review outcomes.</summary>
    Reviews = 2,

    /// <summary>Operational alerts for admins and leads (branches, categories, delivery failures).</summary>
    System = 3,
}

/// <summary>Which topic an event belongs to — and which events nobody may opt out of.</summary>
public static class NotificationTopics
{
    /// <summary>
    /// <c>null</c> for an event that is always delivered, whatever the person's settings: an
    /// invitation is how an account gets a password at all, so switching it off would lock a person
    /// out. An event type added later is mandatory until it is mapped here on purpose.
    /// </summary>
    public static NotificationTopic? For(string eventType) => eventType switch
    {
        NotificationEventTypes.AssignmentAssigned
            or NotificationEventTypes.AssignmentSuggested
            or NotificationEventTypes.AssignmentReassigned
            or NotificationEventTypes.AssignmentCancelled => NotificationTopic.Assignments,

        NotificationEventTypes.DeadlineReminder
            or NotificationEventTypes.AssignmentOverdue => NotificationTopic.Deadlines,

        NotificationEventTypes.SubmissionUploaded
            or NotificationEventTypes.LateSubmissionUploaded
            or NotificationEventTypes.SubmissionReceipt
            or NotificationEventTypes.ReviewApproved
            or NotificationEventTypes.ReviewNeedsRework => NotificationTopic.Reviews,

        NotificationEventTypes.SchedulerNoActiveMentor
            or NotificationEventTypes.CategoryWithoutLead
            or NotificationEventTypes.BranchDeactivated
            or NotificationEventTypes.BranchActivated
            or NotificationEventTypes.UserBranchChanged
            or NotificationEventTypes.BranchWithoutAdmin
            or NotificationEventTypes.OrganizationSystemAlert
            or NotificationEventTypes.NotificationDeadLetter => NotificationTopic.System,

        _ => null,
    };
}

namespace MentorTaskFlow.Contracts.Journal;

/// <summary>Query of <c>GET /journal</c>: newest first, optionally narrowed to kinds of events or one task.</summary>
public sealed record JournalQuery
{
    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = 50;

    /// <summary>Comma-separated <c>TaskEventType</c> names, for example <c>DeadlineChanged,DetailsEdited</c>.</summary>
    public string? EventTypes { get; init; }

    public Guid? AssignmentId { get; init; }

    public DateTimeOffset? From { get; init; }

    public DateTimeOffset? To { get; init; }
}

/// <summary>Who acted or whom it concerned: name and role, as they are now.</summary>
public sealed record JournalPersonDto(Guid Id, string FullName, string Role, string? AdminScope);

/// <summary>
/// One field before and after. <c>Field</c> is <c>title</c>, <c>description</c>, <c>dueAt</c> (ISO
/// instants) or <c>assignee</c> (full names).
/// </summary>
public sealed record JournalChangeDto(string Field, string? Before, string? After);

/// <summary>
/// One step of a task's life, taken from its append-only history (<c>task_events</c>), which the
/// application role can neither change nor delete.
/// </summary>
public sealed record JournalEntryDto(
    Guid Id,
    DateTimeOffset OccurredAt,
    string EventType,
    string? PreviousStatus,
    string? NewStatus,
    Guid AssignmentId,
    string AssignmentTitle,
    string? BranchName,
    JournalPersonDto? Actor,
    JournalPersonDto? Assignee,
    IReadOnlyList<JournalChangeDto> Changes,
    string? Note,
    int? Version);

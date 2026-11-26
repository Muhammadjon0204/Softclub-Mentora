using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Journal;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Assignments;

/// <summary>
/// The task journal of every role, read from <c>task_events</c>.
/// </summary>
/// <remarks>
/// <para>
/// Scope is the assignment list's own (<see cref="AssignmentVisibility"/>): a mentor sees their tasks,
/// a lead the tasks of their category — their team, and their own work in it — a branch administrator
/// their branch, the organization administrator everything. On top of that everybody sees what they
/// did themselves, even on a task that has since moved out of their reach.
/// </para>
/// <para>
/// Nothing here can be edited: the history table is append-only for the application role (EVT-001),
/// so what one person did cannot later be retold differently. Names are shown, not masked: the point
/// of the journal is that everyone can see who changed their task, and how.
/// </para>
/// </remarks>
public sealed class JournalService(
    MentorTaskFlowDbContext dbContext,
    ICurrentUserAccessor currentUser,
    IBranchContext branchContext) : IJournalService
{
    public async Task<PagedResult<JournalEntryDto>> ListAsync(JournalQuery query, CancellationToken cancellationToken)
    {
        var actor = currentUser.Current ?? throw new UnauthorizedException();

        var page = Math.Max(query.Page, PaginationLimits.DefaultPage);
        var pageSize = Math.Clamp(query.PageSize, PaginationLimits.MinPageSize, PaginationLimits.MaxPageSize);

        var organizationAssignments = dbContext.Assignments
            .AsNoTracking()
            .Where(a => a.OrganizationId == branchContext.EffectiveOrganizationId);

        var visibleIds = AssignmentVisibility.Apply(organizationAssignments, actor).Select(a => a.Id);
        var organizationIds = organizationAssignments.Select(a => a.Id);

        var events = dbContext.TaskEvents
            .AsNoTracking()
            .Where(e => visibleIds.Contains(e.AssignmentId)
                        || (e.ActorId == actor.UserId && organizationIds.Contains(e.AssignmentId)));

        if (!string.IsNullOrWhiteSpace(query.EventTypes))
        {
            var types = query.EventTypes
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(name => Enum.TryParse<TaskEventType>(name, out var type)
                    ? type
                    : throw new ValidationAppException("eventTypes", $"Неизвестный тип события: {name}."))
                .ToArray();
            events = events.Where(e => types.Contains(e.EventType));
        }

        if (query.AssignmentId is { } assignmentId)
        {
            events = events.Where(e => e.AssignmentId == assignmentId);
        }

        if (query.From is { } from)
        {
            var since = from.ToUniversalTime();
            events = events.Where(e => e.OccurredAt >= since);
        }

        if (query.To is { } to)
        {
            var until = to.ToUniversalTime();
            events = events.Where(e => e.OccurredAt < until);
        }

        var total = await events.CountAsync(cancellationToken);
        if (total == 0)
        {
            return PagedResult<JournalEntryDto>.Empty(page, pageSize);
        }

        var rows = await events
            .OrderByDescending(e => e.OccurredAt)
            .ThenByDescending(e => e.SequenceNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var assignmentIds = rows.Select(e => e.AssignmentId).Distinct().ToArray();
        var assignments = await dbContext.Assignments
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(a => assignmentIds.Contains(a.Id))
            .Select(a => new { a.Id, a.Title, a.BranchId, a.AssignedToId })
            .ToDictionaryAsync(a => a.Id, cancellationToken);

        var branchIds = assignments.Values.Select(a => a.BranchId).Distinct().ToArray();
        var branches = await dbContext.Branches
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(b => branchIds.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.Name, cancellationToken);

        // Everyone named on the page: who acted, whose task it is, and both sides of a reassignment.
        var userIds = rows.Where(e => e.ActorId is not null).Select(e => e.ActorId!.Value)
            .Concat(assignments.Values.Select(a => a.AssignedToId))
            .Concat(rows.SelectMany(e => new[] { ReadGuid(e, "previousAssignedToId"), ReadGuid(e, "newAssignedToId") })
                .Where(id => id is not null).Select(id => id!.Value))
            .Distinct()
            .ToArray();
        var people = await dbContext.Users
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new JournalPersonDto(u.Id, u.FullName, u.Role.ToString(), u.AdminScope == null ? null : u.AdminScope.ToString()))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        // A review decision carries the reviewer's comment, which is what a returned task is about.
        var reviewIds = rows.Select(e => ReadGuid(e, "reviewId")).Where(id => id is not null).Select(id => id!.Value).ToArray();
        var reviewComments = reviewIds.Length == 0
            ? new Dictionary<Guid, string?>()
            : await dbContext.Reviews
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(r => reviewIds.Contains(r.Id))
                .ToDictionaryAsync(r => r.Id, r => r.Comment, cancellationToken);

        var items = rows.Select(e =>
        {
            var assignment = assignments.GetValueOrDefault(e.AssignmentId);
            JournalPersonDto? Person(Guid? id) => id is { } value ? people.GetValueOrDefault(value) : null;

            return new JournalEntryDto(
                e.Id,
                e.OccurredAt,
                e.EventType.ToString(),
                e.PreviousStatus?.ToString(),
                e.NewStatus?.ToString(),
                e.AssignmentId,
                assignment?.Title ?? string.Empty,
                assignment is null ? null : branches.GetValueOrDefault(assignment.BranchId),
                Person(e.ActorId),
                Person(assignment?.AssignedToId),
                ReadChanges(e, people),
                ReadNote(e, reviewComments),
                ReadInt(e, "versionNumber"));
        }).ToList();

        return new PagedResult<JournalEntryDto>(items, page, pageSize, total);
    }

    /// <summary>Before and after, from what each writer of <c>task_events</c> records.</summary>
    private static List<JournalChangeDto> ReadChanges(TaskEvent e, IReadOnlyDictionary<Guid, JournalPersonDto> people)
    {
        var changes = new List<JournalChangeDto>();

        switch (e.EventType)
        {
            case TaskEventType.DeadlineChanged or TaskEventType.ReviewNeedsRework:
                var before = ReadString(e, "previousCurrentDueAt");
                var after = ReadString(e, "newCurrentDueAt");
                if (after is not null && before != after)
                {
                    changes.Add(new JournalChangeDto("dueAt", before, after));
                }

                break;

            case TaskEventType.DetailsEdited:
                var previousTitle = ReadString(e, "previousTitle");
                var newTitle = ReadString(e, "newTitle");
                if (previousTitle != newTitle)
                {
                    changes.Add(new JournalChangeDto("title", previousTitle, newTitle));
                }

                if (ReadBool(e, "descriptionChanged") == true)
                {
                    changes.Add(new JournalChangeDto("description", ReadString(e, "previousDescription"), ReadString(e, "newDescription")));
                }

                break;

            case TaskEventType.Reassigned:
                string? Name(Guid? id) => id is { } value && people.TryGetValue(value, out var p) ? p.FullName : null;
                changes.Add(new JournalChangeDto("assignee", Name(ReadGuid(e, "previousAssignedToId")), Name(ReadGuid(e, "newAssignedToId"))));
                break;
        }

        return changes;
    }

    private static string? ReadNote(TaskEvent e, IReadOnlyDictionary<Guid, string?> reviewComments) => e.EventType switch
    {
        TaskEventType.DeadlineChanged => ReadString(e, "reason"),
        TaskEventType.Cancelled => ReadString(e, "cancelReason"),
        TaskEventType.ReviewApproved or TaskEventType.ReviewNeedsRework =>
            ReadGuid(e, "reviewId") is { } reviewId ? reviewComments.GetValueOrDefault(reviewId) : null,
        _ => null,
    };

    private static JsonElement? Property(TaskEvent e, string name) =>
        e.Metadata is { } metadata
        && metadata.RootElement.ValueKind == JsonValueKind.Object
        && metadata.RootElement.TryGetProperty(name, out var value)
        && value.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined)
            ? value
            : null;

    private static string? ReadString(TaskEvent e, string name) => Property(e, name) is { } value
        ? value.ValueKind == JsonValueKind.String ? value.GetString() : value.GetRawText()
        : null;

    private static Guid? ReadGuid(TaskEvent e, string name) =>
        Property(e, name) is { ValueKind: JsonValueKind.String } value && value.TryGetGuid(out var id) ? id : null;

    private static int? ReadInt(TaskEvent e, string name) =>
        Property(e, name) is { ValueKind: JsonValueKind.Number } value && value.TryGetInt32(out var number) ? number : null;

    private static bool? ReadBool(TaskEvent e, string name) =>
        Property(e, name) is { ValueKind: JsonValueKind.True or JsonValueKind.False } value ? value.GetBoolean() : null;
}

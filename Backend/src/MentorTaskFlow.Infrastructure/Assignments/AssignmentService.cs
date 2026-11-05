using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Contracts.Assignments;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Tenancy;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Persistence;
using MentorTaskFlow.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Assignments;

/// <inheritdoc />
public sealed class AssignmentService(
    MentorTaskFlowDbContext dbContext,
    ICurrentUserAccessor currentUser,
    IBranchContext branchContext,
    ITenantStateGuard tenantState,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IRequestContext requestContext,
    IDeadlineCalculator deadlines,
    IClock clock) : IAssignmentService
{
    private static readonly string[] SortableColumns = ["currentDueAt", "createdAt", "status"];

    // -----------------------------------------------------------------
    // Reads
    // -----------------------------------------------------------------

    public async Task<PagedResult<AssignmentDto>> ListAsync(AssignmentListQuery query, CancellationToken cancellationToken)
    {
        var actor = RequireActor();

        var page = Math.Max(query.Page, PaginationLimits.DefaultPage);
        var pageSize = Math.Clamp(query.PageSize, PaginationLimits.MinPageSize, PaginationLimits.MaxPageSize);

        var source = ApplyVisibility(
            dbContext.Assignments.AsNoTracking().Where(a => a.OrganizationId == branchContext.EffectiveOrganizationId),
            actor);

        if (!string.IsNullOrWhiteSpace(query.Status) && Enum.TryParse<AssignmentStatus>(query.Status, out var status))
        {
            source = source.Where(a => a.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(query.Source) && Enum.TryParse<AssignmentSource>(query.Source, out var assignmentSource))
        {
            source = source.Where(a => a.Source == assignmentSource);
        }

        if (query.CategoryId is { } categoryId)
        {
            source = source.Where(a => a.CategoryId == categoryId);
        }

        if (query.DueFrom is { } dueFrom)
        {
            var from = dueFrom.ToUniversalTime();
            source = source.Where(a => a.CurrentDueAt >= from);
        }

        if (query.DueTo is { } dueTo)
        {
            var to = dueTo.ToUniversalTime();
            source = source.Where(a => a.CurrentDueAt < to);
        }

        if (query.AssignedById is { } assignedById)
        {
            source = source.Where(a => a.AssignedById == assignedById);
        }

        // Applied after the ownership narrowing above, so for a Mentor it can only ever shrink the
        // result further — never widen it past their own tasks.
        if (query.AssignedToId is { } assignedToId && actor.Role is not UserRole.Mentor)
        {
            source = source.Where(a => a.AssignedToId == assignedToId);
        }

        source = ApplySort(source, query);

        var totalCount = await source.CountAsync(cancellationToken);

        var rows = await source
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AssignmentRow(a, EF.Property<uint>(a, ConcurrencyTokenExtensions.PropertyName)))
            .ToListAsync(cancellationToken);

        var branches = branchContext.IsAllBranchesReadContext
            ? await LoadBranchSummariesAsync(rows.Select(r => r.Assignment.BranchId), cancellationToken)
            : [];

        var assigners = await AssignmentOwnership.LoadAssignersAsync(
            dbContext, rows.Select(r => r.Assignment), cancellationToken);

        var items = rows
            .Select(row => ToDto(
                row.Assignment,
                ConcurrencyTokenAccessor.EncodeFrom(row.Xmin),
                branches.GetValueOrDefault(row.Assignment.BranchId),
                actor,
                row.Assignment.AssignedById is { } by ? assigners.GetValueOrDefault(by) : null))
            .ToList();

        return new PagedResult<AssignmentDto>(items, page, pageSize, totalCount);
    }

    public async Task<AssignmentDto> GetAsync(Guid assignmentId, CancellationToken cancellationToken)
    {
        var row = await FindReadableAsync(assignmentId, cancellationToken);

        return await ToDtoAsync(row.Assignment, ConcurrencyTokenAccessor.EncodeFrom(row.Xmin), cancellationToken);
    }

    public async Task<IReadOnlyList<TaskEventDto>> GetHistoryAsync(Guid assignmentId, CancellationToken cancellationToken)
    {
        var actor = RequireActor();
        await FindReadableAsync(assignmentId, cancellationToken);

        var events = await dbContext.TaskEvents
            .AsNoTracking()
            .Where(e => e.AssignmentId == assignmentId)
            .OrderBy(e => e.SequenceNumber)
            .ToListAsync(cancellationToken);

        // EVT-004: a Mentor sees the role of whoever acted, not their identity. The history has to be
        // readable — it explains what happened to their task — without naming other people.
        var hideActor = actor.Role is UserRole.Mentor;

        IReadOnlySet<Guid> adminActors = hideActor
            ? await LoadAdminActorsAsync(events, cancellationToken)
            : new HashSet<Guid>();

        return events
            .Select(e =>
            {
                var deadline = ReadDeadlineChange(e);

                return new TaskEventDto(
                    e.Id,
                    e.SequenceNumber,
                    e.EventType.ToString(),
                    hideActor ? null : e.ActorId,
                    hideActor ? ActorLabel(e, adminActors) : null,
                    e.PreviousStatus?.ToString(),
                    e.NewStatus?.ToString(),
                    e.OccurredAt,
                    e.CorrelationId,
                    deadline.Previous,
                    deadline.New,
                    deadline.Reason);
            })
            .ToList();
    }

    // -----------------------------------------------------------------
    // Transitions
    // -----------------------------------------------------------------

    public Task<AssignmentDto> CreateDraftAsync(CreateAssignmentDraftRequest request, CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();

        return strategy.ExecuteAsync(() => CreateDraftCoreAsync(request, cancellationToken));
    }

    private async Task<AssignmentDto> CreateDraftCoreAsync(
        CreateAssignmentDraftRequest request,
        CancellationToken cancellationToken)
    {
        var actor = RequireManager();
        var (branchId, categoryId) = await ResolveNewWorkScopeAsync(actor, request.AssignedToId, cancellationToken);

        dbContext.ChangeTracker.Clear();
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        await tenantState.EnsureWritableAsync(branchId, categoryId, cancellationToken);

        // FOR SHARE on the assignee, held to commit: the other half of the FOR UPDATE a transfer takes
        // (scenarios 11 and 20 of Приложение K). Creation is the only way a mentor acquires work
        // without an existing non-terminal task already blocking the transfer, so it is the only path
        // where the two operations can both pass their own check and produce a task in a branch its
        // executor has just left.
        await dbContext.Database.ExecuteSqlAsync(
            $"SELECT id FROM users WHERE id = {request.AssignedToId} FOR SHARE",
            cancellationToken);

        await EnsureAssigneeIsUsableAsync(actor, request.AssignedToId, categoryId, cancellationToken);

        var template = await ResolveTemplateAsync(request.TopicAssignmentId, categoryId, cancellationToken);

        // 10.6.1: the template's title and description are copied now and stop tracking it. A later
        // edit of the template must not rewrite work already handed out.
        var title = request.Title ?? template?.Title
            ?? throw new ValidationAppException("title", "Название обязательно, если не указан шаблон задания.");

        var description = request.Description ?? template?.Description;

        var dueAt = await ResolveDueAtAsync(request.DueAt, categoryId, cancellationToken);
        var now = clock.UtcNow;

        var assignment = Assignment.CreateDraft(
            branchContext.EffectiveOrganizationId,
            branchId,
            categoryId,
            request.AssignedToId,
            actor.UserId,
            request.TopicAssignmentId,
            title,
            description,
            dueAt,
            now);

        dbContext.Assignments.Add(assignment);

        RecordEvent(assignment, TaskEventType.DraftCreated, actor.UserId, null, AssignmentStatus.Draft, now,
            JsonSerializer.SerializeToDocument(new
            {
                assignedToId = assignment.AssignedToId,
                topicAssignmentId = assignment.TopicAssignmentId,
                initialDueAt = assignment.InitialDueAt,
            }));

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    public async Task<AssignmentDto> UpdateAsync(Guid assignmentId, UpdateAssignmentRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireManager();
        var assignment = await FindOwnedAsync(actor, assignmentId, cancellationToken);
        dbContext.Expect(assignment, request.ConcurrencyToken);

        if (assignment.AssignedToId != request.AssignedToId)
        {
            await EnsureAssigneeIsUsableAsync(actor, request.AssignedToId, assignment.CategoryId, cancellationToken);
            assignment.Reassign(request.AssignedToId, hasSubmissions: false, clock.UtcNow);
        }

        assignment.Edit(request.Title, request.Description, request.DueAt, clock.UtcNow);

        await dbContext.SaveWithConcurrencyCheckAsync(assignment, cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    public async Task<AssignmentDto> PublishAsync(Guid assignmentId, AssignmentActionRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireManager();
        var assignment = await FindOwnedAsync(actor, assignmentId, cancellationToken);
        dbContext.Expect(assignment, request.ConcurrencyToken);

        // ASN-008: publishing onto a deactivated mentor would hand work to somebody who cannot sign in.
        await EnsureAssigneeIsUsableAsync(actor, assignment.AssignedToId, assignment.CategoryId, cancellationToken);

        var now = clock.UtcNow;
        var previous = assignment.Status;

        assignment.Publish(actor.UserId, now);

        RecordEvent(assignment, TaskEventType.Assigned, actor.UserId, previous, assignment.Status, now,
            JsonSerializer.SerializeToDocument(new
            {
                assignedById = actor.UserId,
                assignedToId = assignment.AssignedToId,
                currentDueAt = assignment.CurrentDueAt,
            }));

        await NotifyAssigneeAsync(assignment, NotificationEventTypes.AssignmentAssigned, cancellationToken);

        WriteAudit(AuditActions.AssignmentPublish, assignment, new
        {
            title = assignment.Title,
            assignedToId = assignment.AssignedToId,
            currentDueAt = assignment.CurrentDueAt,
        });

        await dbContext.SaveWithConcurrencyCheckAsync(assignment, cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    public async Task<AssignmentDto> AcceptSuggestionAsync(Guid assignmentId, AssignmentActionRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireLead();
        var assignment = await FindOwnedAsync(actor, assignmentId, cancellationToken);
        dbContext.Expect(assignment, request.ConcurrencyToken);

        await EnsureAssigneeIsUsableAsync(actor, assignment.AssignedToId, assignment.CategoryId, cancellationToken);

        var now = clock.UtcNow;
        var previous = assignment.Status;

        assignment.AcceptSuggestion(actor.UserId, now);

        // EVT-005: two events for one transition, sharing a correlation id and taking consecutive
        // sequence numbers. The Lead's decision and the publication are separate facts a review may
        // need to tell apart.
        RecordEvent(assignment, TaskEventType.SuggestionAccepted, actor.UserId, previous, previous, now,
            JsonSerializer.SerializeToDocument(new { acceptedById = actor.UserId, edited = false }));

        RecordEvent(assignment, TaskEventType.Assigned, actor.UserId, previous, assignment.Status, now,
            JsonSerializer.SerializeToDocument(new
            {
                assignedById = actor.UserId,
                assignedToId = assignment.AssignedToId,
                currentDueAt = assignment.CurrentDueAt,
            }));

        await NotifyAssigneeAsync(assignment, NotificationEventTypes.AssignmentAssigned, cancellationToken);

        await dbContext.SaveWithConcurrencyCheckAsync(assignment, cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    public async Task<AssignmentDto> ReassignAsync(Guid assignmentId, ReassignAssignmentRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireManager();
        var assignment = await FindOwnedAsync(actor, assignmentId, cancellationToken);
        dbContext.Expect(assignment, request.ConcurrencyToken);

        await EnsureAssigneeIsUsableAsync(actor, request.AssignedToId, assignment.CategoryId, cancellationToken);

        // 10.6.3: after the first submission the executor is fixed. Reassigning would leave one
        // person's work attached to a task now owned by another.
        var hasSubmissions = assignment.FirstSubmittedAt is not null;

        var previousAssigneeId = assignment.AssignedToId;
        var now = clock.UtcNow;
        var wasPublished = assignment.Status is AssignmentStatus.Assigned;

        assignment.Reassign(request.AssignedToId, hasSubmissions, now);

        // NewStatus is null: reassignment changes the executor, not the state of the work.
        RecordEvent(assignment, TaskEventType.Reassigned, actor.UserId, assignment.Status, null, now,
            JsonSerializer.SerializeToDocument(new
            {
                previousAssignedToId = previousAssigneeId,
                newAssignedToId = assignment.AssignedToId,
                reason = request.Reason,
            }));

        // Only a published task has an executor who knows about it; nobody needs telling that a draft
        // changed hands (Приложение B).
        if (wasPublished)
        {
            // The sequence number keeps a second reassignment of the same task from being deduplicated
            // against the first, and the recipient keeps the two halves of one reassignment apart.
            await NotifyUserAsync(assignment, previousAssigneeId, NotificationEventTypes.AssignmentReassigned,
                cancellationToken, $"{assignment.LastEventSequence}:{previousAssigneeId:N}");

            await NotifyAssigneeAsync(assignment, NotificationEventTypes.AssignmentReassigned,
                cancellationToken, $"{assignment.LastEventSequence}:{assignment.AssignedToId:N}");
        }

        WriteAudit(AuditActions.AssignmentReassign, assignment, new
        {
            title = assignment.Title,
            previousAssignedToId = previousAssigneeId,
            newAssignedToId = assignment.AssignedToId,
        });

        await dbContext.SaveWithConcurrencyCheckAsync(assignment, cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    public async Task<AssignmentDto> RescheduleAsync(Guid assignmentId, RescheduleAssignmentRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireManager();
        var assignment = await FindOwnedAsync(actor, assignmentId, cancellationToken);
        dbContext.Expect(assignment, request.ConcurrencyToken);

        var now = clock.UtcNow;
        var previous = assignment.Status;
        var reason = (request.Reason ?? string.Empty).Trim();

        var previousDueAt = assignment.Reschedule(request.DueAt, reason, now);

        // NewStatus is filled only when the move lifted the task out of Overdue; otherwise this is a
        // change of date, not of state.
        RecordEvent(
            assignment,
            TaskEventType.DeadlineChanged,
            actor.UserId,
            previous,
            assignment.Status == previous ? null : assignment.Status,
            now,
            JsonSerializer.SerializeToDocument(new
            {
                previousCurrentDueAt = previousDueAt,
                newCurrentDueAt = assignment.CurrentDueAt,
                reason,
            }));

        // The sequence number keeps a second move of the same task from being deduplicated away.
        await NotifyAssigneeAsync(
            assignment,
            NotificationEventTypes.AssignmentDeadlineChanged,
            cancellationToken,
            assignment.LastEventSequence.ToString());

        WriteAudit(AuditActions.AssignmentDeadlineChange, assignment, new
        {
            title = assignment.Title,
            previousCurrentDueAt = previousDueAt,
            newCurrentDueAt = assignment.CurrentDueAt,
            reason,
        });

        await dbContext.SaveWithConcurrencyCheckAsync(assignment, cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    public async Task<AssignmentDto> StartReviewAsync(Guid assignmentId, AssignmentActionRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireManager();
        var assignment = await FindOwnedAsync(actor, assignmentId, cancellationToken);
        dbContext.Expect(assignment, request.ConcurrencyToken);

        var now = clock.UtcNow;
        var previous = assignment.Status;

        assignment.StartReview(now);

        RecordEvent(assignment, TaskEventType.ReviewStarted, actor.UserId, previous, assignment.Status, now,
            JsonSerializer.SerializeToDocument(new { reviewerId = actor.UserId }));

        await dbContext.SaveWithConcurrencyCheckAsync(assignment, cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    public async Task<AssignmentDto> CancelAsync(Guid assignmentId, CancelAssignmentRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireActor();
        var assignment = await FindCancellableAsync(actor, assignmentId, cancellationToken);
        dbContext.Expect(assignment, request.ConcurrencyToken);

        var now = clock.UtcNow;
        var previous = assignment.Status;
        var isForceCancel = actor.Role is UserRole.Admin;

        assignment.Cancel(actor.UserId, request.CancelReason, now);

        RecordEvent(assignment, TaskEventType.Cancelled, actor.UserId, previous, assignment.Status, now,
            JsonSerializer.SerializeToDocument(new
            {
                cancelledById = actor.UserId,
                cancelReason = assignment.CancelReason,
                forceCancel = isForceCancel,
            }));

        // The mentor is told only if they ever knew about the task; an unpublished draft was never
        // theirs (Приложение B, transitions 2 and 4).
        if (previous is not (AssignmentStatus.Draft or AssignmentStatus.Suggested))
        {
            await NotifyAssigneeAsync(assignment, NotificationEventTypes.AssignmentCancelled, cancellationToken);
        }

        // ASN-025: a force-cancel is the single administrative action inside the study cycle, so it is
        // audited even though ordinary lifecycle moves are not — those live in TaskEvent (AUD-004).
        if (isForceCancel)
        {
            auditWriter.Write(new AuditEntry
            {
                Action = AuditActions.AssignmentForceCancel,
                EntityType = nameof(Assignment),
                EntityId = assignment.Id,
                BranchId = assignment.BranchId,
                CategoryId = assignment.CategoryId,
                Metadata = JsonSerializer.SerializeToDocument(new
                {
                    previousStatus = previous.ToString(),
                    cancelReason = assignment.CancelReason,
                }),
            });
        }

        await dbContext.SaveWithConcurrencyCheckAsync(assignment, cancellationToken);

        return await ToDtoAsync(assignment, dbContext.Read(assignment), cancellationToken);
    }

    // -----------------------------------------------------------------
    // Events and notifications
    // -----------------------------------------------------------------

    /// <summary>
    /// Appends a TaskEvent to the current unit of work.
    /// </summary>
    /// <remarks>
    /// Staged rather than saved, so the status change, the event and any outbox rows commit in one
    /// transaction. A partial result is not acceptable: a status change without its event is a defect
    /// checked by <c>TEST-EVT-001</c> (<c>ASN-023</c>, <c>EVT-002</c>).
    /// </remarks>
    private void RecordEvent(
        Assignment assignment,
        TaskEventType eventType,
        Guid? actorId,
        AssignmentStatus? previousStatus,
        AssignmentStatus? newStatus,
        DateTimeOffset now,
        JsonDocument? metadata = null) =>
        dbContext.TaskEvents.Add(TaskEvent.Record(
            assignment,
            eventType,
            actorId,
            previousStatus,
            newStatus,
            requestContext.CorrelationId,
            now,
            metadata));

    /// <summary>
    /// Records a step a superior follows from the audit log.
    /// </summary>
    /// <remarks>
    /// The branch comes from the assignment, not the request: an Organization Admin acting from the
    /// all-branches view has none selected, and the event belongs to the branch the work is in.
    /// </remarks>
    private void WriteAudit(string action, Assignment assignment, object metadata) =>
        auditWriter.Write(new AuditEntry
        {
            Action = action,
            EntityType = nameof(Assignment),
            EntityId = assignment.Id,
            BranchId = assignment.BranchId,
            CategoryId = assignment.CategoryId,
            Metadata = JsonSerializer.SerializeToDocument(metadata),
        });

    private Task NotifyAssigneeAsync(
        Assignment assignment,
        string eventType,
        CancellationToken cancellationToken,
        string? discriminator = null) =>
        NotifyUserAsync(assignment, assignment.AssignedToId, eventType, cancellationToken, discriminator);

    /// <summary>
    /// Enqueues one notification about an assignment.
    /// </summary>
    /// <remarks>
    /// The deduplication key is built by the writer from the template of <c>NTF-015</c>; the caller
    /// supplies only the discriminator when one event can legitimately repeat on one object.
    /// </remarks>
    private Task NotifyUserAsync(
        Assignment assignment,
        Guid recipientId,
        string eventType,
        CancellationToken cancellationToken,
        string? discriminator = null) =>
        outboxWriter.EnqueueSystemAsync(
            new OutboxEntry
            {
                RecipientUserId = recipientId,
                EventType = eventType,
                EntityId = assignment.Id,
                Discriminator = discriminator,
                CategoryId = assignment.CategoryId,

                // No identifiers beyond what the recipient already owns, and no deadline arithmetic:
                // the renderer formats the moment in the category's zone when it sends (UX-001).
                Payload = JsonSerializer.SerializeToDocument(new
                {
                    assignmentTitle = assignment.Title,
                    currentDueAt = assignment.CurrentDueAt,
                }),
            },
            assignment.OrganizationId,
            assignment.BranchId,
            cancellationToken);

    // -----------------------------------------------------------------
    // Scope and guards
    // -----------------------------------------------------------------

    private ICurrentUserContext RequireActor() => currentUser.Current ?? throw new UnauthorizedException();

    /// <summary>Scheduler suggestions are the Lead's alone: they belong to the category's curriculum.</summary>
    private ICurrentUserContext RequireLead()
    {
        var actor = RequireActor();

        return actor.Role is UserRole.Lead
            ? actor
            : throw new ForbiddenException(ErrorCodes.Forbidden, "Операция доступна только тимлиду категории.");
    }

    /// <summary>
    /// Lead or Admin: the people who can hand work out.
    /// </summary>
    /// <remarks>
    /// Being one of them is not enough to act on a given task: <see cref="FindOwnedAsync"/> then
    /// requires the caller to be the one who handed it out (<see cref="AssignmentOwnership"/>).
    /// </remarks>
    private ICurrentUserContext RequireManager()
    {
        var actor = RequireActor();

        return actor.Role is UserRole.Lead or UserRole.Admin
            ? actor
            : throw new ForbiddenException(ErrorCodes.Forbidden, "Операция недоступна ментору.");
    }

    private static IQueryable<Assignment> ApplyVisibility(IQueryable<Assignment> source, ICurrentUserContext actor) => actor switch
    {
        // Level 4 of TZ 9.1: a Mentor sees their own tasks, and never the drafts or suggestions of
        // their category — a suggestion is a proposal the Lead has not yet accepted.
        { Role: UserRole.Mentor } => source.Where(a =>
            a.AssignedToId == actor.UserId
            && a.Status != AssignmentStatus.Draft
            && a.Status != AssignmentStatus.Suggested),

        // A Lead can be an executor too, and an administrator's unpublished draft for them is no more
        // theirs to see than a Mentor's is.
        { Role: UserRole.Lead } => source.Where(a =>
            a.CategoryId == actor.CategoryId
            && !(a.AssignedToId == actor.UserId
                && (a.Status == AssignmentStatus.Draft || a.Status == AssignmentStatus.Suggested))),

        { Role: UserRole.Admin, AdminScope: AdminScope.Branch } => source.Where(a => a.BranchId == actor.BranchId),
        _ => source,
    };

    private async Task<AssignmentRow> FindReadableAsync(Guid assignmentId, CancellationToken cancellationToken)
    {
        var actor = RequireActor();

        return await ApplyVisibility(
                dbContext.Assignments
                    .AsNoTracking()
                    .Where(a => a.Id == assignmentId && a.OrganizationId == branchContext.EffectiveOrganizationId),
                actor)
            .Select(a => new AssignmentRow(a, EF.Property<uint>(a, ConcurrencyTokenExtensions.PropertyName)))
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException();
    }

    /// <summary>
    /// Loads a tracked assignment the caller leads (<see cref="AssignmentOwnership"/>).
    /// </summary>
    /// <remarks>
    /// Two different answers on purpose. A task outside the caller's reach is 404: it must be
    /// indistinguishable from one that does not exist (<c>TEN-006</c>). A task they can see but did not
    /// hand out is 403, because a superior looking at it needs to know why they cannot act.
    /// </remarks>
    private async Task<Assignment> FindOwnedAsync(
        ICurrentUserContext actor,
        Guid assignmentId,
        CancellationToken cancellationToken)
    {
        var assignment = await dbContext.Assignments.FirstOrDefaultAsync(
                a => a.Id == assignmentId && a.OrganizationId == branchContext.EffectiveOrganizationId,
                cancellationToken)
            ?? throw new NotFoundException();

        var reachable = actor switch
        {
            { Role: UserRole.Lead } => assignment.CategoryId == actor.CategoryId,
            { Role: UserRole.Admin, AdminScope: AdminScope.Branch } => assignment.BranchId == actor.BranchId,
            { Role: UserRole.Admin, AdminScope: AdminScope.Organization } => true,
            _ => false,
        };

        if (!reachable)
        {
            throw new NotFoundException();
        }

        var assigner = await AssignmentOwnership.LoadAssignerAsync(dbContext, assignment.AssignedById, cancellationToken);

        if (!AssignmentOwnership.IsOwner(actor, assignment, assigner))
        {
            throw new ForbiddenException(
                ErrorCodes.AssignmentNotOwner,
                "Вести задание может только тот, кто его выдал.");
        }

        await tenantState.EnsureWritableAsync(assignment.BranchId, assignment.CategoryId, cancellationToken);

        return assignment;
    }

    /// <summary>
    /// Where new work lands: a Lead's own category, or for an administrator the assignee's.
    /// </summary>
    /// <remarks>
    /// An administrator has no category of their own, and <c>SEC-003</c> forbids taking scope from the
    /// client, so it is read from the person the work is for. A Branch Admin reaching past their
    /// branch gets the same 409 a direct insert would get from the trigger.
    /// </remarks>
    private async Task<(Guid BranchId, Guid CategoryId)> ResolveNewWorkScopeAsync(
        ICurrentUserContext actor,
        Guid assigneeId,
        CancellationToken cancellationToken)
    {
        if (actor.Role is UserRole.Lead)
        {
            return (actor.BranchId!.Value, actor.CategoryId!.Value);
        }

        var assignee = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == assigneeId && u.OrganizationId == branchContext.EffectiveOrganizationId)
            .Select(u => new { u.BranchId, u.CategoryId })
            .FirstOrDefaultAsync(cancellationToken);

        var inContour = assignee is { BranchId: not null, CategoryId: not null }
            && (actor.AdminScope is AdminScope.Organization || assignee.BranchId == actor.BranchId);

        return inContour
            ? (assignee!.BranchId!.Value, assignee.CategoryId!.Value)
            : throw new ConflictException(
                ErrorCodes.CrossScopeReference,
                "Исполнитель должен быть ментором или тимлидом в вашем контуре.",
                new Dictionary<string, object?> { ["relation"] = "assignedToId" });
    }

    /// <summary>
    /// Loads an assignment the caller may cancel — the Lead of its category, or an administrator
    /// within their contour.
    /// </summary>
    private async Task<Assignment> FindCancellableAsync(
        ICurrentUserContext actor,
        Guid assignmentId,
        CancellationToken cancellationToken)
    {
        if (actor.Role is UserRole.Mentor)
        {
            // The mentor can see their own task but cannot stop it: that decision belongs to whoever
            // handed the work out (TZ 9.3).
            throw new ForbiddenException(ErrorCodes.Forbidden, "Отмена задачи недоступна ментору.");
        }

        var assignment = await dbContext.Assignments.FirstOrDefaultAsync(
                a => a.Id == assignmentId && a.OrganizationId == branchContext.EffectiveOrganizationId,
                cancellationToken)
            ?? throw new NotFoundException();

        var reachable = actor switch
        {
            { Role: UserRole.Lead } => assignment.CategoryId == actor.CategoryId,
            { Role: UserRole.Admin, AdminScope: AdminScope.Branch } => assignment.BranchId == actor.BranchId,

            // BRN-033: an Organization Admin must name the branch. A force-cancel is the one mutation
            // permitted inside a deactivated branch, and it has to be attributed to one.
            { Role: UserRole.Admin, AdminScope: AdminScope.Organization } =>
                assignment.BranchId == branchContext.RequireBranchForMutation(),

            _ => false,
        };

        if (!reachable)
        {
            throw new NotFoundException();
        }

        // A Lead sees an administrator's task in their category but it is not theirs to stop. An
        // administrator keeps the force-cancel below for any task in reach: it is the way out when
        // work gets stuck, and it is audited.
        if (actor.Role is UserRole.Lead
            && !AssignmentOwnership.IsOwner(actor, assignment, await AssignmentOwnership.LoadAssignerAsync(dbContext, assignment.AssignedById, cancellationToken)))
        {
            throw new ForbiddenException(
                ErrorCodes.AssignmentNotOwner,
                "Вести задание может только тот, кто его выдал.");
        }

        // Deliberately no EnsureWritableAsync: BRN-033 allows a force-cancel inside a deactivated
        // branch precisely so stuck work can be closed out.
        if (actor.Role is UserRole.Lead)
        {
            await tenantState.EnsureWritableAsync(assignment.BranchId, assignment.CategoryId, cancellationToken);
        }

        return assignment;
    }

    /// <summary>
    /// Verifies the executor is an active person of the same category (<c>ASN-008</c>).
    /// </summary>
    /// <remarks>
    /// <para>
    /// A Lead hands work to their mentors. An administrator can also hand it to the Lead: everyone
    /// below them, which is why this looks at who is asking.
    /// </para>
    /// <para>
    /// Somebody from another branch or category answers 409 <c>CROSS_SCOPE_REFERENCE</c>, and the
    /// trigger <c>trg_assignments_executor_scope</c> refuses the same combination in the database —
    /// application validation is never the only guard (<c>TEN-025</c>).
    /// </para>
    /// </remarks>
    private async Task EnsureAssigneeIsUsableAsync(
        ICurrentUserContext actor,
        Guid assigneeId,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var assignee = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == assigneeId && u.OrganizationId == branchContext.EffectiveOrganizationId)
            .Select(u => new { u.Role, u.CategoryId, u.IsActive })
            .FirstOrDefaultAsync(cancellationToken);

        var roleAccepted = assignee?.Role is UserRole.Mentor
            || (assignee?.Role is UserRole.Lead && actor.Role is UserRole.Admin);

        if (assignee is null || !roleAccepted || assignee.CategoryId != categoryId)
        {
            throw new ConflictException(
                ErrorCodes.CrossScopeReference,
                actor.Role is UserRole.Admin
                    ? "Исполнитель должен быть ментором или тимлидом этой категории."
                    : "Исполнитель должен быть ментором этой категории.",
                new Dictionary<string, object?> { ["relation"] = "assignedToId" });
        }

        if (!assignee.IsActive)
        {
            throw new ConflictException(
                ErrorCodes.AssigneeInactive,
                "Исполнитель деактивирован.");
        }
    }

    /// <summary>Loads the template a draft is built from, checking it belongs to the same category.</summary>
    private async Task<Domain.Schedule.TopicAssignment?> ResolveTemplateAsync(
        Guid? topicAssignmentId,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        if (topicAssignmentId is not { } id)
        {
            return null;
        }

        var template = await dbContext.TopicAssignments
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.CategoryId == categoryId, cancellationToken);

        return template ?? throw new ConflictException(
            ErrorCodes.CrossScopeReference,
            "Шаблон задания не принадлежит этой категории.",
            new Dictionary<string, object?> { ["relation"] = "topicAssignmentId" });
    }

    /// <summary>
    /// Resolves the deadline (<c>ASN-027</c>).
    /// </summary>
    /// <remarks>
    /// A full moment is taken as given. Nothing at all falls back to the category's default number of
    /// days at its <c>DefaultDueTimeLocal</c> — which is why 2.1 introduced that field: «PlannedDate +
    /// DueDays» alone never said what time of day the work was due.
    /// </remarks>
    private async Task<DateTimeOffset> ResolveDueAtAsync(
        DateTimeOffset? requested,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.CategorySettings
            .AsNoTracking()
            .Where(s => s.CategoryId == categoryId)
            .Select(s => new { s.TimeZoneId, s.DefaultAssignmentDueDays, s.DefaultDueTimeLocal })
            .FirstAsync(cancellationToken);

        var now = clock.UtcNow;

        if (requested is { } dueAt)
        {
            return dueAt > now
                ? dueAt
                : throw new ValidationAppException("dueAt", "Дедлайн должен быть в будущем.");
        }

        var localToday = DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(settings.TimeZoneId)).DateTime);

        return deadlines.CalculateInitialDueAt(
            localToday,
            settings.DefaultAssignmentDueDays,
            settings.DefaultDueTimeLocal,
            settings.TimeZoneId);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private static string ActorLabel(TaskEvent taskEvent, IReadOnlySet<Guid> adminActors) => taskEvent.ActorId switch
    {
        null => "Система",
        { } id when adminActors.Contains(id) => "Администратор",
        _ => "Lead",
    };

    private async Task<IReadOnlySet<Guid>> LoadAdminActorsAsync(
        IReadOnlyCollection<TaskEvent> events,
        CancellationToken cancellationToken)
    {
        var actorIds = events.Where(e => e.ActorId is not null).Select(e => e.ActorId!.Value).Distinct().ToArray();

        var admins = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => actorIds.Contains(u.Id) && u.Role == UserRole.Admin)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        return admins.ToHashSet();
    }

    /// <summary>The two events that move a deadline say so in their metadata; everything else has nothing.</summary>
    private static (DateTimeOffset? Previous, DateTimeOffset? New, string? Reason) ReadDeadlineChange(TaskEvent taskEvent)
    {
        if (taskEvent.EventType is not (TaskEventType.DeadlineChanged or TaskEventType.ReviewNeedsRework)
            || taskEvent.Metadata is not { } metadata)
        {
            return (null, null, null);
        }

        var root = metadata.RootElement;

        return (
            root.TryGetProperty("previousCurrentDueAt", out var previous) ? previous.GetDateTimeOffset() : null,
            root.TryGetProperty("newCurrentDueAt", out var next) ? next.GetDateTimeOffset() : null,
            root.TryGetProperty("reason", out var reason) ? reason.GetString() : null);
    }

    private static IQueryable<Assignment> ApplySort(IQueryable<Assignment> source, AssignmentListQuery query)
    {
        var descending = string.Equals(query.Order, "desc", StringComparison.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(query.Sort)
            && !SortableColumns.Contains(query.Sort, StringComparer.OrdinalIgnoreCase))
        {
            throw new ValidationAppException(
                "sort",
                $"Сортировка допустима только по полям: {string.Join(", ", SortableColumns)}.");
        }

        return query.Sort?.ToLowerInvariant() switch
        {
            "createdat" => descending ? source.OrderByDescending(a => a.CreatedAt) : source.OrderBy(a => a.CreatedAt),
            "status" => descending ? source.OrderByDescending(a => a.Status) : source.OrderBy(a => a.Status),
            _ => descending ? source.OrderByDescending(a => a.CurrentDueAt) : source.OrderBy(a => a.CurrentDueAt),
        };
    }

    private async Task<Dictionary<Guid, BranchSummaryDto>> LoadBranchSummariesAsync(
        IEnumerable<Guid> branchIds,
        CancellationToken cancellationToken)
    {
        var ids = branchIds.Distinct().ToArray();

        return await dbContext.Branches
            .AsNoTracking()
            .Where(b => ids.Contains(b.Id))
            .Select(b => new BranchSummaryDto(b.Id, b.Name, b.Code, b.IsHeadOffice))
            .ToDictionaryAsync(b => b.Id, cancellationToken);
    }

    private async Task<AssignmentDto> ToDtoAsync(Assignment assignment, string concurrencyToken, CancellationToken cancellationToken)
    {
        var assigner = await AssignmentOwnership.LoadAssignerAsync(dbContext, assignment.AssignedById, cancellationToken);

        return ToDto(assignment, concurrencyToken, null, RequireActor(), assigner);
    }

    private static AssignmentDto ToDto(
        Assignment assignment,
        string concurrencyToken,
        BranchSummaryDto? branch,
        ICurrentUserContext actor,
        AssignerInfo? assigner) => new(
        assignment.Id,
        assignment.OrganizationId,
        assignment.BranchId,
        assignment.CategoryId,
        assignment.TopicAssignmentId,
        assignment.AssignedToId,
        assignment.AssignedById,
        assignment.Title,
        assignment.Description,
        assignment.Status.ToString(),
        assignment.Source.ToString(),
        assignment.InitialDueAt,
        assignment.CurrentDueAt,
        assignment.GeneratedForDate,
        assignment.AssignedAt,
        assignment.FirstSubmittedAt,
        assignment.ReviewStartedAt,
        assignment.ApprovedAt,
        assignment.OverdueAt,
        assignment.CancelledAt,
        assignment.CancelReason,
        assignment.CreatedAt,
        concurrencyToken,
        branch,
        assigner?.Role.ToString(),
        AssignmentOwnership.IsOwner(actor, assignment, assigner));

    /// <summary>Carries the shadow <c>xmin</c> out of a no-tracking query alongside its entity.</summary>
    private sealed record AssignmentRow(Assignment Assignment, uint Xmin);
}

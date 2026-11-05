using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Proposals;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Proposals;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Notifications;
using MentorTaskFlow.Infrastructure.Persistence;
using MentorTaskFlow.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Proposals;

/// <inheritdoc />
/// <remarks>
/// The Lead of the category decides, because they know whether a master class fits the curriculum and
/// will be the one reviewing the result. An administrator decides only for a category with no active
/// Lead: otherwise they watch, as they do with any work they did not hand out.
/// </remarks>
public sealed class ProposalService(
    MentorTaskFlowDbContext dbContext,
    ICurrentUserAccessor currentUser,
    IBranchContext branchContext,
    ITenantStateGuard tenantState,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IRequestContext requestContext,
    IClock clock) : IProposalService
{
    public async Task<PagedResult<ProposalDto>> ListAsync(ProposalListQuery query, CancellationToken cancellationToken)
    {
        var actor = RequireActor();

        var page = Math.Max(query.Page, PaginationLimits.DefaultPage);
        var pageSize = Math.Clamp(query.PageSize, PaginationLimits.MinPageSize, PaginationLimits.MaxPageSize);

        var source = ApplyVisibility(
            dbContext.Proposals.AsNoTracking().Where(p => p.OrganizationId == branchContext.EffectiveOrganizationId),
            actor);

        if (!string.IsNullOrWhiteSpace(query.Status) && Enum.TryParse<ProposalStatus>(query.Status, out var status))
        {
            source = source.Where(p => p.Status == status);
        }

        var totalCount = await source.CountAsync(cancellationToken);

        var rows = await source
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProposalRow(p, EF.Property<uint>(p, ConcurrencyTokenExtensions.PropertyName)))
            .ToListAsync(cancellationToken);

        return new PagedResult<ProposalDto>(await MapAsync(actor, rows, cancellationToken), page, pageSize, totalCount);
    }

    public async Task<ProposalDto> GetAsync(Guid proposalId, CancellationToken cancellationToken)
    {
        var actor = RequireActor();

        var row = await ApplyVisibility(
                dbContext.Proposals
                    .AsNoTracking()
                    .Where(p => p.Id == proposalId && p.OrganizationId == branchContext.EffectiveOrganizationId),
                actor)
            .Select(p => new ProposalRow(p, EF.Property<uint>(p, ConcurrencyTokenExtensions.PropertyName)))
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException();

        return (await MapAsync(actor, [row], cancellationToken))[0];
    }

    public async Task<ProposalDto> CreateAsync(CreateProposalRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireMentor();

        await tenantState.EnsureWritableAsync(actor.BranchId, actor.CategoryId, cancellationToken);

        var proposal = Proposal.Submit(
            branchContext.EffectiveOrganizationId,
            actor.BranchId!.Value,
            actor.CategoryId!.Value,
            actor.UserId,
            ParseKind(request.Kind),
            request.Title,
            request.Description,
            request.PreferredAt,
            clock.UtcNow);

        dbContext.Proposals.Add(proposal);

        await NotifyDecidersAsync(proposal, actor.UserId, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        return await ToDtoAsync(actor, proposal, cancellationToken);
    }

    public async Task<ProposalDto> UpdateAsync(Guid proposalId, UpdateProposalRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireMentor();
        var proposal = await FindOwnAsync(actor, proposalId, cancellationToken);
        dbContext.Expect(proposal, request.ConcurrencyToken);

        proposal.Edit(ParseKind(request.Kind), request.Title, request.Description, request.PreferredAt, clock.UtcNow);

        await dbContext.SaveWithConcurrencyCheckAsync(proposal, cancellationToken);

        return await ToDtoAsync(actor, proposal, cancellationToken);
    }

    public async Task<ProposalDto> WithdrawAsync(Guid proposalId, ProposalActionRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireMentor();
        var proposal = await FindOwnAsync(actor, proposalId, cancellationToken);
        dbContext.Expect(proposal, request.ConcurrencyToken);

        proposal.Withdraw(clock.UtcNow);

        await dbContext.SaveWithConcurrencyCheckAsync(proposal, cancellationToken);

        return await ToDtoAsync(actor, proposal, cancellationToken);
    }

    public Task<ProposalDto> ApproveAsync(Guid proposalId, ApproveProposalRequest request, CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();

        return strategy.ExecuteAsync(() => ApproveCoreAsync(proposalId, request, cancellationToken));
    }

    /// <summary>
    /// The proposal closes and the assignment appears together or not at all.
    /// </summary>
    /// <remarks>
    /// The author is locked <c>FOR SHARE</c> for the same reason a draft locks its assignee: this is a
    /// way to acquire work, and it must not slip past a transfer running at the same moment.
    /// </remarks>
    private async Task<ProposalDto> ApproveCoreAsync(
        Guid proposalId,
        ApproveProposalRequest request,
        CancellationToken cancellationToken)
    {
        var actor = RequireDecider();

        dbContext.ChangeTracker.Clear();
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var proposal = await FindDecidableAsync(actor, proposalId, cancellationToken);
        dbContext.Expect(proposal, request.ConcurrencyToken);

        await dbContext.Database.ExecuteSqlAsync(
            $"SELECT id FROM users WHERE id = {proposal.AuthorId} FOR SHARE",
            cancellationToken);

        var author = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == proposal.AuthorId)
            .Select(u => new { u.IsActive, u.Role, u.CategoryId })
            .FirstAsync(cancellationToken);

        if (author.Role is not UserRole.Mentor || author.CategoryId != proposal.CategoryId)
        {
            throw new ConflictException(
                ErrorCodes.CrossScopeReference,
                "Автор предложения больше не работает в этой категории.",
                new Dictionary<string, object?> { ["relation"] = "authorId" });
        }

        if (!author.IsActive)
        {
            throw new ConflictException(ErrorCodes.AssigneeInactive, "Автор предложения деактивирован.");
        }

        var now = clock.UtcNow;

        if (request.DueAt <= now)
        {
            throw new ValidationAppException("dueAt", "Срок должен быть в будущем.");
        }

        var assignment = Assignment.CreateFromProposal(
            proposal.OrganizationId,
            proposal.BranchId,
            proposal.CategoryId,
            proposal.AuthorId,
            actor.UserId,
            string.IsNullOrWhiteSpace(request.Title) ? proposal.Title : request.Title,
            string.IsNullOrWhiteSpace(request.Description) ? proposal.Description : request.Description,
            request.DueAt,
            now);

        dbContext.Assignments.Add(assignment);

        dbContext.TaskEvents.Add(TaskEvent.Record(
            assignment,
            TaskEventType.Assigned,
            actor.UserId,
            null,
            assignment.Status,
            requestContext.CorrelationId,
            now,
            JsonSerializer.SerializeToDocument(new
            {
                proposalId = proposal.Id,
                assignedById = actor.UserId,
                assignedToId = assignment.AssignedToId,
                currentDueAt = assignment.CurrentDueAt,
            })));

        proposal.Approve(actor.UserId, assignment.Id, request.Comment, now);

        await NotifyAuthorAsync(proposal, NotificationEventTypes.ProposalApproved, assignment.CurrentDueAt, cancellationToken);

        WriteAudit(AuditActions.ProposalApprove, proposal);

        await dbContext.SaveWithConcurrencyCheckAsync(proposal, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await ToDtoAsync(actor, proposal, cancellationToken);
    }

    public async Task<ProposalDto> RejectAsync(Guid proposalId, RejectProposalRequest request, CancellationToken cancellationToken)
    {
        var actor = RequireDecider();
        var proposal = await FindDecidableAsync(actor, proposalId, cancellationToken);
        dbContext.Expect(proposal, request.ConcurrencyToken);

        proposal.Reject(actor.UserId, request.Comment, clock.UtcNow);

        await NotifyAuthorAsync(proposal, NotificationEventTypes.ProposalRejected, null, cancellationToken);

        WriteAudit(AuditActions.ProposalReject, proposal);

        await dbContext.SaveWithConcurrencyCheckAsync(proposal, cancellationToken);

        return await ToDtoAsync(actor, proposal, cancellationToken);
    }

    // -----------------------------------------------------------------
    // Scope and guards
    // -----------------------------------------------------------------

    private ICurrentUserContext RequireActor() => currentUser.Current ?? throw new UnauthorizedException();

    private ICurrentUserContext RequireMentor()
    {
        var actor = RequireActor();

        return actor.Role is UserRole.Mentor
            ? actor
            : throw new ForbiddenException(ErrorCodes.Forbidden, "Предложения подаёт ментор.");
    }

    private ICurrentUserContext RequireDecider()
    {
        var actor = RequireActor();

        return actor.Role is UserRole.Lead or UserRole.Admin
            ? actor
            : throw new ForbiddenException(ErrorCodes.Forbidden, "Решение по предложению недоступно ментору.");
    }

    private static IQueryable<Proposal> ApplyVisibility(IQueryable<Proposal> source, ICurrentUserContext actor) => actor switch
    {
        { Role: UserRole.Mentor } => source.Where(p => p.AuthorId == actor.UserId),
        { Role: UserRole.Lead } => source.Where(p => p.CategoryId == actor.CategoryId),
        { Role: UserRole.Admin, AdminScope: AdminScope.Branch } => source.Where(p => p.BranchId == actor.BranchId),
        _ => source,
    };

    /// <summary>Another mentor's proposal is 404: a Mentor does not learn what colleagues suggest.</summary>
    private async Task<Proposal> FindOwnAsync(ICurrentUserContext actor, Guid proposalId, CancellationToken cancellationToken) =>
        await dbContext.Proposals.FirstOrDefaultAsync(
            p => p.Id == proposalId
                 && p.OrganizationId == branchContext.EffectiveOrganizationId
                 && p.AuthorId == actor.UserId,
            cancellationToken)
        ?? throw new NotFoundException();

    private async Task<Proposal> FindDecidableAsync(ICurrentUserContext actor, Guid proposalId, CancellationToken cancellationToken)
    {
        var proposal = await ApplyVisibility(
                dbContext.Proposals.Where(p => p.Id == proposalId && p.OrganizationId == branchContext.EffectiveOrganizationId),
                actor)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException();

        if (!CanDecide(actor, await HasActiveLeadAsync(proposal.CategoryId, cancellationToken)))
        {
            throw new ForbiddenException(
                ErrorCodes.Forbidden,
                "Решение принимает тимлид направления. Администратор решает, только если тимлида нет.");
        }

        await tenantState.EnsureWritableAsync(proposal.BranchId, proposal.CategoryId, cancellationToken);

        return proposal;
    }

    private static bool CanDecide(ICurrentUserContext actor, bool categoryHasLead) =>
        actor.Role is UserRole.Lead || (actor.Role is UserRole.Admin && !categoryHasLead);

    private Task<bool> HasActiveLeadAsync(Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.CategoryId == categoryId && u.Role == UserRole.Lead && u.IsActive, cancellationToken);

    private static ProposalKind ParseKind(string? kind) =>
        Enum.TryParse<ProposalKind>(kind, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : throw new ValidationAppException("kind", "Неизвестный вид предложения.");

    // -----------------------------------------------------------------
    // Notifications and audit
    // -----------------------------------------------------------------

    /// <summary>The Lead of the category, or the branch's administrators when it has none.</summary>
    private async Task NotifyDecidersAsync(Proposal proposal, Guid authorId, CancellationToken cancellationToken)
    {
        var recipients = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.CategoryId == proposal.CategoryId && u.Role == UserRole.Lead && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        if (recipients.Count == 0)
        {
            recipients = await dbContext.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(u => u.BranchId == proposal.BranchId
                            && u.Role == UserRole.Admin
                            && u.AdminScope == AdminScope.Branch
                            && u.IsActive)
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);
        }

        var authorName = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == authorId)
            .Select(u => u.FullName)
            .FirstAsync(cancellationToken);

        foreach (var recipient in recipients)
        {
            await outboxWriter.EnqueueSystemAsync(
                new OutboxEntry
                {
                    RecipientUserId = recipient,
                    EventType = NotificationEventTypes.ProposalSubmitted,
                    EntityId = proposal.Id,
                    Discriminator = recipient.ToString("N"),
                    CategoryId = proposal.CategoryId,
                    Payload = JsonSerializer.SerializeToDocument(new
                    {
                        proposalTitle = proposal.Title,
                        mentorFullName = authorName,
                    }),
                },
                proposal.OrganizationId,
                proposal.BranchId,
                cancellationToken);
        }
    }

    private Task NotifyAuthorAsync(
        Proposal proposal,
        string eventType,
        DateTimeOffset? dueAt,
        CancellationToken cancellationToken) =>
        outboxWriter.EnqueueSystemAsync(
            new OutboxEntry
            {
                RecipientUserId = proposal.AuthorId,
                EventType = eventType,
                EntityId = proposal.Id,
                CategoryId = proposal.CategoryId,
                Payload = JsonSerializer.SerializeToDocument(new
                {
                    proposalTitle = proposal.Title,
                    decisionComment = proposal.DecisionComment,
                    currentDueAt = dueAt,
                }),
            },
            proposal.OrganizationId,
            proposal.BranchId,
            cancellationToken);

    private void WriteAudit(string action, Proposal proposal) =>
        auditWriter.Write(new AuditEntry
        {
            Action = action,
            EntityType = nameof(Proposal),
            EntityId = proposal.Id,
            BranchId = proposal.BranchId,
            CategoryId = proposal.CategoryId,
            Metadata = JsonSerializer.SerializeToDocument(new
            {
                title = proposal.Title,
                authorId = proposal.AuthorId,
                assignmentId = proposal.AssignmentId,
            }),
        });

    // -----------------------------------------------------------------
    // Mapping
    // -----------------------------------------------------------------

    private Task<ProposalDto> ToDtoAsync(ICurrentUserContext actor, Proposal proposal, CancellationToken cancellationToken) =>
        MapSingleAsync(actor, proposal, dbContext.Read(proposal), cancellationToken);

    private async Task<ProposalDto> MapSingleAsync(
        ICurrentUserContext actor,
        Proposal proposal,
        string concurrencyToken,
        CancellationToken cancellationToken)
    {
        var names = await LoadNamesAsync([proposal], cancellationToken);
        var leads = await LoadLedCategoriesAsync([proposal], cancellationToken);

        return ToDto(actor, proposal, concurrencyToken, names, leads);
    }

    private async Task<IReadOnlyList<ProposalDto>> MapAsync(
        ICurrentUserContext actor,
        IReadOnlyList<ProposalRow> rows,
        CancellationToken cancellationToken)
    {
        var proposals = rows.Select(r => r.Proposal).ToList();
        var names = await LoadNamesAsync(proposals, cancellationToken);
        var leads = await LoadLedCategoriesAsync(proposals, cancellationToken);

        return rows
            .Select(r => ToDto(actor, r.Proposal, ConcurrencyTokenAccessor.EncodeFrom(r.Xmin), names, leads))
            .ToList();
    }

    private async Task<ProposalNames> LoadNamesAsync(IReadOnlyCollection<Proposal> proposals, CancellationToken cancellationToken)
    {
        var userIds = proposals
            .SelectMany(p => new[] { (Guid?)p.AuthorId, p.DecidedById })
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .Distinct()
            .ToArray();

        var categoryIds = proposals.Select(p => p.CategoryId).Distinct().ToArray();

        var users = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

        var categories = await dbContext.Categories
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => categoryIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

        return new ProposalNames(users, categories);
    }

    private async Task<IReadOnlySet<Guid>> LoadLedCategoriesAsync(IReadOnlyCollection<Proposal> proposals, CancellationToken cancellationToken)
    {
        var categoryIds = proposals.Select(p => p.CategoryId).Distinct().ToArray();

        var led = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.CategoryId != null && categoryIds.Contains(u.CategoryId.Value) && u.Role == UserRole.Lead && u.IsActive)
            .Select(u => u.CategoryId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        return led.ToHashSet();
    }

    private static ProposalDto ToDto(
        ICurrentUserContext actor,
        Proposal proposal,
        string concurrencyToken,
        ProposalNames names,
        IReadOnlySet<Guid> ledCategories) => new(
        proposal.Id,
        proposal.BranchId,
        proposal.CategoryId,
        names.Categories.GetValueOrDefault(proposal.CategoryId, string.Empty),
        proposal.AuthorId,
        names.Users.GetValueOrDefault(proposal.AuthorId, string.Empty),
        proposal.Kind.ToString(),
        proposal.Title,
        proposal.Description,
        proposal.PreferredAt,
        proposal.Status.ToString(),
        proposal.DecidedById,
        proposal.DecidedById is { } id ? names.Users.GetValueOrDefault(id) : null,
        proposal.DecidedAt,
        proposal.DecisionComment,
        proposal.AssignmentId,
        proposal.CreatedAt,
        concurrencyToken,
        proposal.Status is ProposalStatus.Pending && CanDecide(actor, ledCategories.Contains(proposal.CategoryId)));

    /// <summary>Carries the shadow <c>xmin</c> out of a no-tracking query alongside its entity.</summary>
    private sealed record ProposalRow(Proposal Proposal, uint Xmin);

    private sealed record ProposalNames(
        IReadOnlyDictionary<Guid, string> Users,
        IReadOnlyDictionary<Guid, string> Categories);
}

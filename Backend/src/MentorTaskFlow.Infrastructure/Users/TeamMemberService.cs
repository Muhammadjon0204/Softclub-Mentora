using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Contracts.Categories;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Users;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MentorTaskFlow.Infrastructure.Users;

/// <inheritdoc />
public sealed class TeamMemberService(
    MentorTaskFlowDbContext dbContext,
    ICurrentUserAccessor currentUser,
    IBranchContext branchContext,
    ITenantStateGuard tenantState,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IClock clock) : ITeamMemberService
{
    private const int CandidateLimit = 50;

    public async Task<IReadOnlyList<TeamMemberDto>> ListAsync(Guid categoryId, CancellationToken cancellationToken)
    {
        var actor = RequireActor();
        var team = await FindTeamAsync(actor, categoryId, cancellationToken);

        var users = await PeopleOfBranch(team)
            .InTeam(dbContext, team.Id)
            .ToListAsync(cancellationToken);

        var roster = await TeamRoster.LoadAsync(dbContext, users, cancellationToken);
        var leadId = await ActiveLeadIdAsync(team.Id, cancellationToken);

        return users
            .Select(user => ToDto(actor, user, roster.In(user.Id, team.Id)!, leadId))
            .OrderBy(m => Enum.Parse<TeamRole>(m.Role))
            .ThenByDescending(m => m.IsActive)
            .ThenBy(m => m.FullName, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<TeamCandidateDto>> ListCandidatesAsync(
        Guid categoryId,
        string? search,
        CancellationToken cancellationToken)
    {
        var actor = RequireActor();
        var team = await FindTeamAsync(actor, categoryId, cancellationToken);

        var source = PeopleOfBranch(team)
            .Where(u => u.IsActive && u.CategoryId != team.Id)
            .Where(u => !dbContext.TeamMemberships.IgnoreQueryFilters()
                .Any(m => m.UserId == u.Id && m.CategoryId == team.Id));

        // A Lead adds mentors and participants, and an administrator is neither theirs to add.
        if (actor.Role is UserRole.Lead)
        {
            source = source.Where(u => u.Role != UserRole.Admin && u.Id != actor.UserId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{EscapeLike(search.Trim())}%";
            source = source.Where(u => EF.Functions.ILike(u.FullName, pattern, "\\") || EF.Functions.ILike(u.Email, pattern, "\\"));
        }

        var users = await source
            .OrderBy(u => u.FullName)
            .Take(CandidateLimit)
            .ToListAsync(cancellationToken);

        var mainTeamIds = users.Where(u => u.CategoryId is not null).Select(u => u.CategoryId!.Value).Distinct().ToArray();

        var mainTeams = await dbContext.Categories
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => mainTeamIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

        var leadId = await ActiveLeadIdAsync(team.Id, cancellationToken);

        return users
            .Select(u => new TeamCandidateDto(
                u.Id,
                u.FullName,
                u.Role.ToString(),
                // The name of another team is the administrator's to know; a Lead sees only their own.
                actor.Role is UserRole.Admin && u.CategoryId is { } main ? mainTeams.GetValueOrDefault(main) : null,
                Names(AssignableRoles(actor, u, place: null, leadId)),
                AvatarService.UrlFor(u.AvatarKey)))
            .Where(c => c.AssignableRoles.Count > 0)
            .ToList();
    }

    public Task<TeamMemberDto> AddAsync(Guid categoryId, AddTeamMemberRequest request, CancellationToken cancellationToken) =>
        InTransactionAsync(
            async () =>
            {
                var actor = RequireActor();
                var team = await FindTeamAsync(actor, categoryId, cancellationToken);
                var role = ParseRole(request.Role);

                await tenantState.EnsureWritableAsync(team.BranchId, team.Id, cancellationToken);

                var user = await LockPersonAsync(team, request.UserId, cancellationToken)
                    ?? throw new ConflictException(
                        ErrorCodes.CrossScopeReference,
                        "В команду можно добавить только человека из того же филиала.",
                        new Dictionary<string, object?> { ["relation"] = "userId" });

                if (await dbContext.RoleInTeamAsync(user.Id, team.Id, cancellationToken) is not null)
                {
                    throw new ConflictException(ErrorCodes.ResourceAlreadyExists, "Этот человек уже в команде.");
                }

                if (!user.IsActive)
                {
                    throw new ConflictException(ErrorCodes.AssigneeInactive, "Пользователь деактивирован.");
                }

                var leadId = await ActiveLeadIdAsync(team.Id, cancellationToken);
                EnsureMayGive(actor, user, place: null, role, leadId);

                dbContext.TeamMemberships.Add(
                    TeamMembership.Create(user, team.Id, team.BranchId, role, actor.UserId, clock.UtcNow));

                WriteAudit(AuditActions.CategoryMemberAdd, team, user, new { role = role.ToString() });

                await SaveAsync(cancellationToken);

                return ToDto(actor, user, new TeamPlace(team.Id, role, IsMain: false), role is TeamRole.Lead ? user.Id : leadId);
            },
            cancellationToken);

    public Task<TeamMemberDto> ChangeRoleAsync(
        Guid categoryId,
        Guid userId,
        ChangeTeamMemberRoleRequest request,
        CancellationToken cancellationToken) =>
        InTransactionAsync(
            async () =>
            {
                var actor = RequireActor();
                var team = await FindTeamAsync(actor, categoryId, cancellationToken);
                var role = ParseRole(request.Role);

                await tenantState.EnsureWritableAsync(team.BranchId, team.Id, cancellationToken);

                var user = await LockPersonAsync(team, userId, cancellationToken) ?? throw new NotFoundException();
                var place = await PlaceOfAsync(user, team.Id, cancellationToken) ?? throw new NotFoundException();
                var leadId = await ActiveLeadIdAsync(team.Id, cancellationToken);

                if (place.Role == role)
                {
                    return ToDto(actor, user, place, leadId);
                }

                if (place.IsMain && !(user.Role is UserRole.Mentor && role is TeamRole.Mentor or TeamRole.Member))
                {
                    throw new ValidationAppException("role", "В основной команде роль меняется через смену роли пользователя.");
                }

                EnsureMayGive(actor, user, place, role, leadId);

                var membership = await FindMembershipAsync(user.Id, team.Id, cancellationToken);
                var now = clock.UtcNow;

                if (membership is null)
                {
                    // Only a mentor in their main team has no row: calling them «участник» adds one.
                    dbContext.TeamMemberships.Add(
                        TeamMembership.Create(user, team.Id, team.BranchId, role, actor.UserId, now));
                }
                else if (place.IsMain && role is TeamRole.Mentor)
                {
                    dbContext.TeamMemberships.Remove(membership);
                }
                else
                {
                    membership.ChangeRole(user, role, now);
                }

                WriteAudit(AuditActions.CategoryMemberUpdate, team, user, new
                {
                    previousRole = place.Role.ToString(),
                    newRole = role.ToString(),
                });

                if (place.Role is TeamRole.Lead)
                {
                    await NotifyIfLeftWithoutLeadAsync(team, user, cancellationToken);
                }

                await SaveAsync(cancellationToken);

                return ToDto(actor, user, place with { Role = role }, role is TeamRole.Lead ? user.Id : null);
            },
            cancellationToken);

    public Task RemoveAsync(Guid categoryId, Guid userId, CancellationToken cancellationToken) =>
        InTransactionAsync(
            async () =>
            {
                var actor = RequireActor();
                var team = await FindTeamAsync(actor, categoryId, cancellationToken);

                // The lock is the other half of the FOR SHARE taken while work is being given out: a
                // task cannot slip in between the check below and the removal.
                var user = await LockPersonAsync(team, userId, cancellationToken) ?? throw new NotFoundException();
                var place = await PlaceOfAsync(user, team.Id, cancellationToken) ?? throw new NotFoundException();

                if (place.IsMain)
                {
                    throw new ValidationAppException(
                        "userId",
                        "Это основная команда человека: переведите его в другую или деактивируйте.");
                }

                if (!CanRemove(actor, user, place))
                {
                    throw Refused("Убрать этого участника может только администратор.");
                }

                var blocking = await dbContext.Assignments
                    .IgnoreQueryFilters()
                    .Where(a => a.AssignedToId == user.Id
                                && a.CategoryId == team.Id
                                && a.Status != AssignmentStatus.Approved
                                && a.Status != AssignmentStatus.Cancelled)
                    .OrderBy(a => a.CreatedAt)
                    .Select(a => a.Id)
                    .ToListAsync(cancellationToken);

                if (blocking.Count > 0)
                {
                    throw new ConflictException(
                        ErrorCodes.CategoryChangeBlocked,
                        "У участника есть незавершённые задания в этой команде.",
                        new Dictionary<string, object?>
                        {
                            ["reason"] = TransferBlockReasons.ActiveAssignments,
                            ["blockingAssignmentIds"] = blocking,
                        });
                }

                var membership = await FindMembershipAsync(user.Id, team.Id, cancellationToken)
                    ?? throw new NotFoundException();

                dbContext.TeamMemberships.Remove(membership);
                WriteAudit(AuditActions.CategoryMemberRemove, team, user, new { role = place.Role.ToString() });

                if (place.Role is TeamRole.Lead)
                {
                    await NotifyIfLeftWithoutLeadAsync(team, user, cancellationToken);
                }

                await SaveAsync(cancellationToken);

                return true;
            },
            cancellationToken);

    // -----------------------------------------------------------------
    // Rules
    // -----------------------------------------------------------------

    /// <summary>The roles the caller may give this person in this team; empty when they may not touch them.</summary>
    private static IReadOnlyList<TeamRole> AssignableRoles(
        ICurrentUserContext actor,
        User user,
        TeamPlace? place,
        Guid? leadId)
    {
        if (user is { Role: UserRole.Admin, AdminScope: AdminScope.Organization })
        {
            return [];
        }

        if (actor.Role is UserRole.Lead
            && (user.Role is UserRole.Admin || user.Id == actor.UserId || place?.Role is TeamRole.Lead))
        {
            return [];
        }

        // The account decides the title in the main team; a mentor there may also be «участник».
        if (place is { IsMain: true })
        {
            return user.Role is UserRole.Mentor ? [TeamRole.Mentor, TeamRole.Member] : [];
        }

        List<TeamRole> roles = user.Role is UserRole.Admin ? [TeamRole.Member] : [TeamRole.Mentor, TeamRole.Member];

        // One lead per team: offered only while the place is free, or to whoever holds it.
        if (actor.Role is UserRole.Admin && (leadId is null || leadId == user.Id))
        {
            roles.Insert(0, TeamRole.Lead);
        }

        return roles;
    }

    private static bool CanRemove(ICurrentUserContext actor, User user, TeamPlace place) =>
        !place.IsMain
        && (actor.Role is UserRole.Admin
            || (user.Role is not UserRole.Admin && user.Id != actor.UserId && place.Role is not TeamRole.Lead));

    private static void EnsureMayGive(ICurrentUserContext actor, User user, TeamPlace? place, TeamRole role, Guid? leadId)
    {
        // Said precisely rather than as a refusal: the administrator may appoint, just not a second one.
        if (role is TeamRole.Lead && actor.Role is UserRole.Admin && leadId is { } current && current != user.Id)
        {
            throw new ConflictException(ErrorCodes.ActiveLeadAlreadyExists, "В команде уже есть активный тимлид.");
        }

        if (user.Role is UserRole.Admin && role is TeamRole.Mentor)
        {
            throw new ValidationAppException("role", "Администратор может быть в команде участником или тимлидом.");
        }

        if (!AssignableRoles(actor, user, place, leadId).Contains(role))
        {
            throw Refused("Тимлид добавляет только менторов и участников; тимлидов и администраторов — администратор.");
        }
    }

    private static ForbiddenException Refused(string detail) => new(ErrorCodes.Forbidden, detail);

    private static TeamRole ParseRole(string? value) =>
        Enum.TryParse<TeamRole>(value, ignoreCase: false, out var role) && Enum.IsDefined(role)
            && string.Equals(role.ToString(), value, StringComparison.Ordinal)
            ? role
            : throw new ValidationAppException("role", "Роль в команде: Lead, Mentor или Member.");

    // -----------------------------------------------------------------
    // Data
    // -----------------------------------------------------------------

    private ICurrentUserContext RequireActor() => currentUser.Current ?? throw new UnauthorizedException();

    /// <summary>A team the caller manages; anything else is 404, like a team that does not exist (<c>TEN-006</c>).</summary>
    private async Task<Category> FindTeamAsync(ICurrentUserContext actor, Guid categoryId, CancellationToken cancellationToken)
    {
        var team = await dbContext.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(
                c => c.Id == categoryId && c.OrganizationId == branchContext.EffectiveOrganizationId,
                cancellationToken)
            ?? throw new NotFoundException();

        var managed = actor switch
        {
            { Role: UserRole.Admin, AdminScope: AdminScope.Organization } => true,
            { Role: UserRole.Admin, AdminScope: AdminScope.Branch } => team.BranchId == actor.BranchId,
            { Role: UserRole.Lead } => team.Id == actor.CategoryId,
            _ => false,
        };

        return managed ? team : throw new NotFoundException();
    }

    private IQueryable<User> PeopleOfBranch(Category team) => dbContext.Users
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(u => u.OrganizationId == team.OrganizationId && u.BranchId == team.BranchId);

    private async Task<User?> LockPersonAsync(Category team, Guid userId, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlAsync(
            $"SELECT id FROM users WHERE id = {userId} AND organization_id = {team.OrganizationId} AND branch_id = {team.BranchId} FOR UPDATE",
            cancellationToken);

        return await PeopleOfBranch(team).FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
    }

    private async Task<TeamPlace?> PlaceOfAsync(User user, Guid categoryId, CancellationToken cancellationToken)
    {
        var roster = await TeamRoster.LoadAsync(dbContext, [user], cancellationToken);

        return roster.In(user.Id, categoryId);
    }

    private Task<TeamMembership?> FindMembershipAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.TeamMemberships
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.UserId == userId && m.CategoryId == categoryId, cancellationToken);

    private Task<Guid?> ActiveLeadIdAsync(Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.Users
            .IgnoreQueryFilters()
            .LeadingTeam(dbContext, categoryId)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync(cancellationToken);

    private Task<T> InTransactionAsync<T>(Func<Task<T>> work, CancellationToken cancellationToken) =>
        dbContext.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

            var result = await work();

            await transaction.CommitAsync(cancellationToken);
            return result;
        });

    private async Task SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
                                                  {
                                                      SqlState: PostgresErrorCodes.UniqueViolation,
                                                  } postgres)
        {
            // Two administrators acting at once: the database decides who came second.
            throw postgres.ConstraintName switch
            {
                "ux_users_active_lead_per_category" => new ConflictException(
                    ErrorCodes.ActiveLeadAlreadyExists, "В команде уже есть активный тимлид."),
                "ux_team_memberships_user_category" => new ConflictException(
                    ErrorCodes.ResourceAlreadyExists, "Этот человек уже в команде."),
                _ => exception,
            };
        }
    }

    private void WriteAudit(string action, Category team, User user, object metadata) =>
        auditWriter.Write(new AuditEntry
        {
            Action = action,
            EntityType = nameof(User),
            EntityId = user.Id,
            BranchId = team.BranchId,
            CategoryId = team.Id,
            Metadata = JsonSerializer.SerializeToDocument(metadata),
        });

    /// <summary>
    /// Tells the administrators when a team has just lost its only lead (<c>USER-005</c>). Called
    /// before the save, so «another lead» means somebody other than the person being changed.
    /// </summary>
    private async Task NotifyIfLeftWithoutLeadAsync(Category team, User user, CancellationToken cancellationToken)
    {
        var hasAnotherLead = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id != user.Id)
            .LeadingTeam(dbContext, team.Id)
            .AnyAsync(cancellationToken);

        if (hasAnotherLead)
        {
            return;
        }

        var recipients = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(u => u.OrganizationId == team.OrganizationId && u.Role == UserRole.Admin && u.IsActive)
            .Where(u => u.AdminScope == AdminScope.Organization || u.BranchId == team.BranchId)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        foreach (var recipientId in recipients)
        {
            await outboxWriter.EnqueueSystemAsync(
                new OutboxEntry
                {
                    RecipientUserId = recipientId,
                    EventType = NotificationEventTypes.CategoryWithoutLead,

                    // Keyed by the team, so one alert per team per day follows (NTF-015).
                    EntityId = team.Id,
                    Discriminator = $"{clock.UtcNow.UtcDateTime:yyyy-MM-dd}:{recipientId:N}",
                    CategoryId = team.Id,
                    Payload = JsonSerializer.SerializeToDocument(new { subjectFullName = user.FullName }),
                },
                team.OrganizationId,
                team.BranchId,
                cancellationToken);
        }
    }

    private static TeamMemberDto ToDto(ICurrentUserContext actor, User user, TeamPlace place, Guid? leadId) => new(
        user.Id,
        user.FullName,
        user.Email,
        place.Role.ToString(),
        user.Role.ToString(),
        place.IsMain,
        user.IsActive,
        Names(AssignableRoles(actor, user, place, leadId)),
        CanRemove(actor, user, place),
        AvatarService.UrlFor(user.AvatarKey));

    private static IReadOnlyList<string> Names(IEnumerable<TeamRole> roles) => roles.Select(r => r.ToString()).ToList();

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}

using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Contracts.Access;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Domain.Access;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Access;

/// <inheritdoc />
/// <remarks>
/// Every query pins the organization explicitly and ignores the query filters: sign-in runs before a
/// tenant scope exists, and the explicit condition is the protection either way (<c>SEC-030</c>).
/// </remarks>
public sealed class PermissionService(
    MentorTaskFlowDbContext dbContext,
    ICurrentUserAccessor currentUser,
    IBranchContext branchContext,
    IAuditWriter auditWriter,
    IClock clock) : IPermissionService
{
    public async Task<bool> HasAsync(string permission, CancellationToken cancellationToken)
    {
        var actor = RequireActor();

        if (Permissions.SubjectOf(actor.Role, actor.AdminScope) is not { } subject)
        {
            return true;
        }

        if (Permissions.Find(permission) is not { } definition)
        {
            return false;
        }

        var roleRule = await dbContext.RolePermissions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.OrganizationId == actor.OrganizationId && r.Subject == subject && r.Permission == permission)
            .Select(r => (bool?)r.Allowed)
            .FirstOrDefaultAsync(cancellationToken);

        var userOverride = await dbContext.UserPermissions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.UserId == actor.UserId && u.Permission == permission)
            .Select(u => (bool?)u.Allowed)
            .FirstOrDefaultAsync(cancellationToken);

        return Permissions.Resolve(definition, subject, roleRule, userOverride);
    }

    public async Task<IReadOnlyList<string>> GetEffectiveAsync(
        Guid userId,
        UserRole role,
        AdminScope? adminScope,
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        if (Permissions.SubjectOf(role, adminScope) is not { } subject)
        {
            return Permissions.All.Select(p => p.Key).ToList();
        }

        var roleRules = await LoadRoleRulesAsync(organizationId, cancellationToken);
        var overrides = await LoadOverridesAsync(userId, cancellationToken);

        return Permissions.All
            .Where(p => Resolve(p, subject, roleRules, overrides))
            .Select(p => p.Key)
            .ToList();
    }

    public async Task<IReadOnlyList<RolePermissionRowDto>> GetRoleMatrixAsync(CancellationToken cancellationToken)
    {
        var rules = await LoadRoleRulesAsync(branchContext.EffectiveOrganizationId, cancellationToken);

        return BuildMatrix(rules);
    }

    public async Task<IReadOnlyList<RolePermissionRowDto>> SetRoleRuleAsync(
        SetRolePermissionRequest request,
        CancellationToken cancellationToken)
    {
        var actor = RequireActor();

        if (!Enum.TryParse<PermissionSubject>(request.Subject, out var subject)
            || !Enum.IsDefined(subject))
        {
            throw new ValidationAppException("subject", "Неизвестная роль.");
        }

        var definition = RequireDefinition(request.Permission, subject);
        var organizationId = branchContext.EffectiveOrganizationId;
        var now = clock.UtcNow;

        var rule = await dbContext.RolePermissions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                r => r.OrganizationId == organizationId && r.Subject == subject && r.Permission == definition.Key,
                cancellationToken);

        var previous = rule?.Allowed;

        switch (rule, request.Allowed)
        {
            case (null, { } allowed):
                dbContext.RolePermissions.Add(
                    RolePermission.Create(organizationId, subject, definition.Key, allowed, actor.UserId, now));
                break;
            case (not null, { } allowed):
                rule.Set(allowed, actor.UserId, now);
                break;
            case (not null, null):
                dbContext.RolePermissions.Remove(rule);
                break;
        }

        auditWriter.Write(new AuditEntry
        {
            Action = AuditActions.PermissionRoleUpdate,
            EntityType = nameof(RolePermission),
            Metadata = JsonSerializer.SerializeToDocument(new
            {
                subject = subject.ToString(),
                permission = definition.Key,
                previous,
                value = request.Allowed,
            }),
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return await GetRoleMatrixAsync(cancellationToken);
    }

    public async Task<UserPermissionsDto> GetForUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var actor = RequireActor();
        var target = await FindVisibleUserAsync(actor, userId, cancellationToken);

        return await MapUserAsync(actor, target, cancellationToken);
    }

    public async Task<UserPermissionsDto> SetForUserAsync(
        Guid userId,
        SetUserPermissionsRequest request,
        CancellationToken cancellationToken)
    {
        var actor = RequireActor();
        var target = await FindVisibleUserAsync(actor, userId, cancellationToken);

        if (!CanEdit(actor, target))
        {
            throw new ForbiddenException(ErrorCodes.Forbidden, "Менять права этого пользователя нельзя.");
        }

        var subject = Permissions.SubjectOf(target.Role, target.AdminScope)!.Value;
        var now = clock.UtcNow;
        var keys = request.Changes.Select(c => c.Permission).ToArray();

        var existing = await dbContext.UserPermissions
            .IgnoreQueryFilters()
            .Where(u => u.UserId == target.Id && keys.Contains(u.Permission))
            .ToDictionaryAsync(u => u.Permission, cancellationToken);

        foreach (var change in request.Changes)
        {
            var definition = RequireDefinition(change.Permission, subject);
            existing.TryGetValue(definition.Key, out var row);

            switch (row, change.Allowed)
            {
                case (null, { } allowed):
                    dbContext.UserPermissions.Add(
                        UserPermission.Create(target.OrganizationId, target.Id, definition.Key, allowed, actor.UserId, now));
                    break;
                case (not null, { } allowed):
                    row.Set(allowed, actor.UserId, now);
                    break;
                case (not null, null):
                    dbContext.UserPermissions.Remove(row);
                    break;
            }
        }

        auditWriter.Write(new AuditEntry
        {
            Action = AuditActions.PermissionUserUpdate,
            EntityType = nameof(User),
            EntityId = target.Id,
            BranchId = target.BranchId,
            CategoryId = target.CategoryId,
            Metadata = JsonSerializer.SerializeToDocument(new
            {
                changes = request.Changes.Select(c => new { permission = c.Permission, value = c.Allowed }),
            }),
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return await MapUserAsync(actor, target, cancellationToken);
    }

    public async Task<IReadOnlyList<PermissionExceptionDto>> ListExceptionsAsync(CancellationToken cancellationToken)
    {
        var actor = RequireActor();
        var organizationId = branchContext.EffectiveOrganizationId;

        var rows = await (
                from permission in dbContext.UserPermissions.IgnoreQueryFilters()
                join user in dbContext.Users.IgnoreQueryFilters() on permission.UserId equals user.Id
                where permission.OrganizationId == organizationId
                      && (actor.AdminScope == AdminScope.Organization || user.BranchId == actor.BranchId)
                orderby user.FullName
                select new
                {
                    user.Id,
                    user.FullName,
                    user.Role,
                    user.BranchId,
                    user.CategoryId,
                    permission.Permission,
                    permission.Allowed,
                })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var branchIds = rows.Where(r => r.BranchId is not null).Select(r => r.BranchId!.Value).Distinct().ToArray();
        var categoryIds = rows.Where(r => r.CategoryId is not null).Select(r => r.CategoryId!.Value).Distinct().ToArray();

        var branches = await dbContext.Branches.IgnoreQueryFilters().AsNoTracking()
            .Where(b => branchIds.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.Name, cancellationToken);

        var categories = await dbContext.Categories.IgnoreQueryFilters().AsNoTracking()
            .Where(c => categoryIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

        return rows
            .GroupBy(r => r.Id)
            .Select(group =>
            {
                var first = group.First();

                return new PermissionExceptionDto(
                    first.Id,
                    first.FullName,
                    first.Role.ToString(),
                    first.BranchId is { } branch ? branches.GetValueOrDefault(branch) : null,
                    first.CategoryId is { } category ? categories.GetValueOrDefault(category) : null,
                    group.Where(r => r.Allowed).Select(r => r.Permission).ToList(),
                    group.Where(r => !r.Allowed).Select(r => r.Permission).ToList());
            })
            .ToList();
    }

    private ICurrentUserContext RequireActor() => currentUser.Current ?? throw new UnauthorizedException();

    private static PermissionDefinition RequireDefinition(string key, PermissionSubject subject)
    {
        var definition = Permissions.Find(key)
            ?? throw new ValidationAppException("permission", "Неизвестное право.");

        return definition.AppliesTo(subject)
            ? definition
            : throw new ValidationAppException("permission", "Это право не относится к этой роли.");
    }

    /// <summary>
    /// Another branch's person is 404 for a Branch Admin (<c>TEN-006</c>). Other administrators of
    /// their own branch stay visible, but only an Organization Admin can change them.
    /// </summary>
    private async Task<User> FindVisibleUserAsync(ICurrentUserContext actor, Guid userId, CancellationToken cancellationToken)
    {
        var target = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                u => u.Id == userId && u.OrganizationId == branchContext.EffectiveOrganizationId,
                cancellationToken)
            ?? throw new NotFoundException();

        if (actor.AdminScope is not AdminScope.Organization && target.BranchId != actor.BranchId)
        {
            throw new NotFoundException();
        }

        return target;
    }

    /// <summary>
    /// Never yourself: nobody widens their own access. Never an Organization Admin: they are the root.
    /// A Branch Admin reaches the Leads and Mentors of their branch and no other administrator.
    /// </summary>
    private static bool CanEdit(ICurrentUserContext actor, User target)
    {
        if (actor.UserId == target.Id || Permissions.SubjectOf(target.Role, target.AdminScope) is null)
        {
            return false;
        }

        return actor.AdminScope is AdminScope.Organization
            || (target.Role is not UserRole.Admin && target.BranchId == actor.BranchId);
    }

    private async Task<UserPermissionsDto> MapUserAsync(ICurrentUserContext actor, User target, CancellationToken cancellationToken)
    {
        var subject = Permissions.SubjectOf(target.Role, target.AdminScope);
        var rows = new List<UserPermissionRowDto>();

        if (subject is { } value)
        {
            var roleRules = await LoadRoleRulesAsync(target.OrganizationId, cancellationToken);
            var overrides = await LoadOverridesAsync(target.Id, cancellationToken);

            rows.AddRange(Permissions.All
                .Where(p => p.AppliesTo(value))
                .Select(p =>
                {
                    var roleValue = Permissions.Resolve(p, value, roleRules.GetValueOrDefault((value, p.Key)), null);
                    bool? userOverride = overrides.TryGetValue(p.Key, out var allowed) ? allowed : null;

                    return new UserPermissionRowDto(p.Key, p.Group, roleValue, userOverride, userOverride ?? roleValue);
                }));
        }

        return new UserPermissionsDto(target.Id, target.FullName, target.Role.ToString(), CanEdit(actor, target), rows);
    }

    private static IReadOnlyList<RolePermissionRowDto> BuildMatrix(
        IReadOnlyDictionary<(PermissionSubject, string), bool> rules) =>
        Permissions.All
            .Select(p => new RolePermissionRowDto(
                p.Key,
                p.Group,
                p.Defaults
                    .OrderBy(d => d.Key)
                    .Select(d =>
                    {
                        bool? rule = rules.TryGetValue((d.Key, p.Key), out var allowed) ? allowed : null;

                        return new RolePermissionCellDto(d.Key.ToString(), d.Value, rule, rule ?? d.Value);
                    })
                    .ToList()))
            .ToList();

    private static bool Resolve(
        PermissionDefinition definition,
        PermissionSubject subject,
        IReadOnlyDictionary<(PermissionSubject, string), bool> roleRules,
        IReadOnlyDictionary<string, bool> overrides) =>
        Permissions.Resolve(
            definition,
            subject,
            roleRules.TryGetValue((subject, definition.Key), out var rule) ? rule : null,
            overrides.TryGetValue(definition.Key, out var value) ? value : null);

    private async Task<IReadOnlyDictionary<(PermissionSubject, string), bool>> LoadRoleRulesAsync(
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.RolePermissions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.OrganizationId == organizationId)
            .Select(r => new { r.Subject, r.Permission, r.Allowed })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(r => (r.Subject, r.Permission), r => r.Allowed);
    }

    private async Task<IReadOnlyDictionary<string, bool>> LoadOverridesAsync(Guid userId, CancellationToken cancellationToken) =>
        await dbContext.UserPermissions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.UserId == userId)
            .ToDictionaryAsync(u => u.Permission, u => u.Allowed, cancellationToken);
}

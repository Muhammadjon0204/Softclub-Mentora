using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Assignments;

/// <summary>Who handed an assignment out, as far as the ownership rule cares.</summary>
public sealed record AssignerInfo(UserRole Role, bool IsActive);

/// <summary>
/// The one rule of who leads an assignment: whoever handed it out.
/// </summary>
/// <remarks>
/// <para>
/// Only the owner reviews the work and changes its terms. Whoever stands above them watches: an
/// administrator who gave no task has no way to judge it, and a verdict from somebody who did not set
/// the work helps nobody. Their tools are the calendar, the task lists and the audit log.
/// </para>
/// <para>
/// Two cases keep work from getting stuck. A task from a Lead belongs to the Lead of the category
/// rather than to one person, so it survives a change of Lead. A task from an administrator who has
/// since been deactivated passes to any administrator who can reach it.
/// </para>
/// <para>
/// Reachability is checked by the caller first and answered with 404 (<c>TEN-006</c>). This decides the
/// next question: the object is visible, so may this person act on it.
/// </para>
/// </remarks>
public static class AssignmentOwnership
{
    public static bool IsOwner(ICurrentUserContext actor, Assignment assignment, AssignerInfo? assigner)
    {
        ArgumentNullException.ThrowIfNull(actor);
        ArgumentNullException.ThrowIfNull(assignment);

        // REV-022, and the same for the terms of the work: nobody leads their own task.
        if (actor.UserId == assignment.AssignedToId)
        {
            return false;
        }

        if (assigner is not { Role: UserRole.Admin })
        {
            return actor.Role is UserRole.Lead && actor.CategoryId == assignment.CategoryId;
        }

        if (actor.UserId == assignment.AssignedById)
        {
            return true;
        }

        return !assigner.IsActive && CanReach(actor, assignment);
    }

    /// <summary>Who to tell about work waiting on its owner. Null when the category has no Lead.</summary>
    public static async Task<Guid?> ResolveOwnerIdAsync(
        MentorTaskFlowDbContext dbContext,
        Guid categoryId,
        Guid? assignedById,
        CancellationToken cancellationToken)
    {
        var assigner = await LoadAssignerAsync(dbContext, assignedById, cancellationToken);

        if (assigner is { Role: UserRole.Admin, IsActive: true })
        {
            return assignedById;
        }

        return await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.CategoryId == categoryId && u.Role == UserRole.Lead && u.IsActive)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public static async Task<AssignerInfo?> LoadAssignerAsync(
        MentorTaskFlowDbContext dbContext,
        Guid? assignedById,
        CancellationToken cancellationToken)
    {
        if (assignedById is not { } id)
        {
            return null;
        }

        // IgnoreQueryFilters: the assigner may be an Organization Admin or may have moved branch since.
        return await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new AssignerInfo(u.Role, u.IsActive))
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>The assigners of a page of assignments, so a list stays one extra query.</summary>
    public static async Task<IReadOnlyDictionary<Guid, AssignerInfo>> LoadAssignersAsync(
        MentorTaskFlowDbContext dbContext,
        IEnumerable<Assignment> assignments,
        CancellationToken cancellationToken)
    {
        var ids = assignments
            .Where(a => a.AssignedById is not null)
            .Select(a => a.AssignedById!.Value)
            .Distinct()
            .ToArray();

        var rows = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.Role, u.IsActive })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(u => u.Id, u => new AssignerInfo(u.Role, u.IsActive));
    }

    private static bool CanReach(ICurrentUserContext actor, Assignment assignment) => actor switch
    {
        { Role: UserRole.Admin, AdminScope: AdminScope.Organization } => actor.OrganizationId == assignment.OrganizationId,
        { Role: UserRole.Admin, AdminScope: AdminScope.Branch } => actor.BranchId == assignment.BranchId,
        _ => false,
    };
}

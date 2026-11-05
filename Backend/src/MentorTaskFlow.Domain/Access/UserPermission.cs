using MentorTaskFlow.Domain.Common;

namespace MentorTaskFlow.Domain.Access;

/// <summary>A personal exception: one person is allowed or refused what their role's rule says.</summary>
/// <remarks>
/// Carries the organization but no branch or category. It is reached only through its user, whose
/// scope the caller has already checked, and a branch column here would go stale on every transfer.
/// </remarks>
public sealed class UserPermission : AuditableEntity
{
    public Guid OrganizationId { get; private set; }

    public Guid UserId { get; private set; }

    public string Permission { get; private set; } = null!;

    public bool Allowed { get; private set; }

    public Guid UpdatedById { get; private set; }

    private UserPermission()
    {
    }

    public static UserPermission Create(
        Guid organizationId,
        Guid userId,
        string permission,
        bool allowed,
        Guid updatedById,
        DateTimeOffset now) =>
        new()
        {
            OrganizationId = organizationId,
            UserId = userId,
            Permission = permission,
            Allowed = allowed,
            UpdatedById = updatedById,
            CreatedAt = now,
            UpdatedAt = now,
        };

    public void Set(bool allowed, Guid updatedById, DateTimeOffset now)
    {
        Allowed = allowed;
        UpdatedById = updatedById;
        UpdatedAt = now;
    }
}

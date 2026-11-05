using MentorTaskFlow.Domain.Common;

namespace MentorTaskFlow.Domain.Access;

/// <summary>
/// An organization's own value for one permission of one role, overriding the catalog default.
/// </summary>
/// <remarks>
/// Only deviations are stored: a row exists while the value is set by hand, and clearing it returns
/// the role to the catalog default, so a default changed in a later release reaches everyone who
/// never touched that switch.
/// </remarks>
public sealed class RolePermission : AuditableEntity
{
    public Guid OrganizationId { get; private set; }

    public PermissionSubject Subject { get; private set; }

    public string Permission { get; private set; } = null!;

    public bool Allowed { get; private set; }

    public Guid UpdatedById { get; private set; }

    private RolePermission()
    {
    }

    public static RolePermission Create(
        Guid organizationId,
        PermissionSubject subject,
        string permission,
        bool allowed,
        Guid updatedById,
        DateTimeOffset now) =>
        new()
        {
            OrganizationId = organizationId,
            Subject = subject,
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

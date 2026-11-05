using MentorTaskFlow.Domain.Access;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MentorTaskFlow.Infrastructure.Persistence.Configurations;

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("role_permissions", table =>
            table.HasCheckConstraint(
                "ck_role_permissions_subject_allowed",
                "subject IN ('BranchAdmin','Lead','Mentor')"));

        builder.HasKey(x => x.Id);

        builder.Property(x => x.OrganizationId).IsRequired();
        builder.Property(x => x.Subject).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(x => x.Permission).HasMaxLength(64).IsRequired();
        builder.Property(x => x.UpdatedById).IsRequired();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(x => x.OrganizationId)
            .HasConstraintName("fk_role_permissions_organization")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UpdatedById)
            .HasConstraintName("fk_role_permissions_updated_by")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.OrganizationId, x.Subject, x.Permission })
            .IsUnique()
            .HasDatabaseName("ux_role_permissions_rule");
    }
}

public sealed class UserPermissionConfiguration : IEntityTypeConfiguration<UserPermission>
{
    public void Configure(EntityTypeBuilder<UserPermission> builder)
    {
        builder.ToTable("user_permissions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.OrganizationId).IsRequired();
        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.Permission).HasMaxLength(64).IsRequired();
        builder.Property(x => x.UpdatedById).IsRequired();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(x => x.OrganizationId)
            .HasConstraintName("fk_user_permissions_organization")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .HasConstraintName("fk_user_permissions_user")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UpdatedById)
            .HasConstraintName("fk_user_permissions_updated_by")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.UserId, x.Permission })
            .IsUnique()
            .HasDatabaseName("ux_user_permissions_user_permission");

        builder.HasIndex(x => new { x.OrganizationId, x.UserId })
            .HasDatabaseName("ix_user_permissions_organization_user");
    }
}

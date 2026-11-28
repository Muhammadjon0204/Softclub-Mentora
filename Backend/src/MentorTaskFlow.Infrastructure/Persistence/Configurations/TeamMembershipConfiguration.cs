using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MentorTaskFlow.Infrastructure.Persistence.Configurations;

public sealed class TeamMembershipConfiguration : IEntityTypeConfiguration<TeamMembership>
{
    public void Configure(EntityTypeBuilder<TeamMembership> builder)
    {
        builder.ToTable("team_memberships", table =>
            table.HasCheckConstraint("ck_team_memberships_role_allowed", "role IN ('Lead','Mentor','Member')"));

        builder.HasKey(x => x.Id);

        builder.Property(x => x.OrganizationId).IsRequired();
        builder.Property(x => x.BranchId).IsRequired();
        builder.Property(x => x.CategoryId).IsRequired();
        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.Role).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(x => x.AddedById).IsRequired();

        // A team of another branch or organization is physically impossible.
        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(x => new { x.CategoryId, x.OrganizationId, x.BranchId })
            .HasPrincipalKey(x => new { x.Id, x.OrganizationId, x.BranchId })
            .HasConstraintName("fk_team_memberships_category_scope")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .HasConstraintName("fk_team_memberships_user")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.AddedById)
            .HasConstraintName("fk_team_memberships_added_by")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.UserId, x.CategoryId })
            .IsUnique()
            .HasDatabaseName("ux_team_memberships_user_category");

        builder.HasIndex(x => new { x.OrganizationId, x.BranchId, x.CategoryId })
            .HasDatabaseName("ix_team_memberships_organization_branch_category");

        builder.ApplyConcurrencyToken();
    }
}

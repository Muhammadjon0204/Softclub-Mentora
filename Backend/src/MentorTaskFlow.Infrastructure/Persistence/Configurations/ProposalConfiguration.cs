using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Proposals;
using MentorTaskFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MentorTaskFlow.Infrastructure.Persistence.Configurations;

public sealed class ProposalConfiguration : IEntityTypeConfiguration<Proposal>
{
    public void Configure(EntityTypeBuilder<Proposal> builder)
    {
        builder.ToTable("proposals", table =>
        {
            table.HasCheckConstraint(
                "ck_proposals_status_allowed",
                "status IN ('Pending','Approved','Rejected','Withdrawn')");

            table.HasCheckConstraint(
                "ck_proposals_kind_allowed",
                "kind IN ('MasterClass','ExtraLesson','Other')");

            // An approval without its assignment, or a decision without somebody who made it, is a
            // defect the database can refuse outright.
            table.HasCheckConstraint(
                "ck_proposals_decision_fields",
                """
                (status = 'Approved' AND assignment_id IS NOT NULL AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL)
                OR (status = 'Rejected' AND assignment_id IS NULL AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL
                    AND decision_comment IS NOT NULL)
                OR (status IN ('Pending','Withdrawn') AND assignment_id IS NULL AND decided_by_id IS NULL AND decided_at IS NULL)
                """);
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.OrganizationId).IsRequired();
        builder.Property(x => x.BranchId).IsRequired();
        builder.Property(x => x.CategoryId).IsRequired();
        builder.Property(x => x.AuthorId).IsRequired();
        builder.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(Proposal.TitleMaxLength).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(Proposal.DescriptionMaxLength).IsRequired();
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(x => x.DecisionComment).HasMaxLength(Proposal.DecisionCommentMaxLength);

        // fk_proposals_category_scope: a proposal cannot name a category of another branch.
        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(x => new { x.CategoryId, x.OrganizationId, x.BranchId })
            .HasPrincipalKey(x => new { x.Id, x.OrganizationId, x.BranchId })
            .HasConstraintName("fk_proposals_category_scope")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.AuthorId)
            .HasConstraintName("fk_proposals_author")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.DecidedById)
            .HasConstraintName("fk_proposals_decided_by")
            .OnDelete(DeleteBehavior.Restrict);

        // fk_proposals_assignment_scope: the work a proposal became lives in the proposal's own scope.
        builder.HasOne<Assignment>()
            .WithMany()
            .HasForeignKey(x => new { x.AssignmentId, x.OrganizationId, x.BranchId, x.CategoryId })
            .HasPrincipalKey(x => new { x.Id, x.OrganizationId, x.BranchId, x.CategoryId })
            .HasConstraintName("fk_proposals_assignment_scope")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.OrganizationId, x.BranchId, x.CategoryId, x.Status, x.CreatedAt })
            .HasDatabaseName("ix_proposals_scope_status_created_at")
            .IsDescending(false, false, false, false, true);

        builder.HasIndex(x => new { x.AuthorId, x.CreatedAt })
            .HasDatabaseName("ix_proposals_author_created_at")
            .IsDescending(false, true);

        builder.ApplyConcurrencyToken();
    }
}

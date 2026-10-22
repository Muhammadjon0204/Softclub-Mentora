using MentorTaskFlow.Domain.Reports;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MentorTaskFlow.Infrastructure.Persistence.Configurations;

public sealed class CrmGroupReportConfiguration : IEntityTypeConfiguration<CrmGroupReport>
{
    public void Configure(EntityTypeBuilder<CrmGroupReport> builder)
    {
        builder.ToTable("crm_group_reports", table =>
        {
            table.HasCheckConstraint("ck_crm_group_reports_status_allowed", "status IN ('Draft','Sent')");

            // «Sent» is what the Lead reads: a sent report without a moment and without conclusions
            // would be an empty report that looks delivered.
            table.HasCheckConstraint("ck_crm_group_reports_sent_shape", "status <> 'Sent' OR sent_at IS NOT NULL");
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.OrganizationId).IsRequired();
        builder.Property(x => x.BranchId).IsRequired();
        builder.Property(x => x.CategoryId).IsRequired();
        builder.Property(x => x.AuthorId).IsRequired();
        builder.Property(x => x.GroupName).HasMaxLength(CrmGroupReport.NameMaxLength).IsRequired();
        builder.Property(x => x.CourseName).HasMaxLength(CrmGroupReport.NameMaxLength).IsRequired();
        builder.Property(x => x.PeriodLabel).HasMaxLength(CrmGroupReport.LabelMaxLength).IsRequired();
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(12).IsRequired();
        builder.Property(x => x.SnapshotJson).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.PreviousSnapshotJson).HasColumnType("jsonb");
        builder.Property(x => x.DataHash).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Conclusions).HasColumnType("text").IsRequired();
        builder.Property(x => x.AiModel).HasMaxLength(64);

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(x => x.OrganizationId)
            .HasConstraintName("fk_crm_group_reports_organization")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.AuthorId)
            .HasConstraintName("fk_crm_group_reports_author")
            .OnDelete(DeleteBehavior.Restrict);

        // One report per group and period, whichever of the group's mentors writes it.
        builder.HasIndex(x => new { x.OrganizationId, x.CrmGroupId, x.Week })
            .IsUnique()
            .HasDatabaseName("ux_crm_group_reports_group_week");

        // The Lead's and the Branch Admin's lists.
        builder.HasIndex(x => new { x.OrganizationId, x.BranchId, x.CategoryId, x.Status })
            .HasDatabaseName("ix_crm_group_reports_scope_status");

        builder.ApplyConcurrencyToken();
    }
}

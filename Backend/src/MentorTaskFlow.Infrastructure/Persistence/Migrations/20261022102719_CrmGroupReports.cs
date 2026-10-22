using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MentorTaskFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CrmGroupReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "crm_group_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    crm_group_id = table.Column<int>(type: "integer", nullable: false),
                    group_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    course_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    week = table.Column<int>(type: "integer", nullable: false),
                    period_label = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    period_from = table.Column<DateOnly>(type: "date", nullable: false),
                    period_to = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    snapshot_json = table.Column<string>(type: "jsonb", nullable: false),
                    data_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    conclusions = table.Column<string>(type: "text", nullable: false),
                    ai_model = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crm_group_reports", x => x.id);
                    table.CheckConstraint("ck_crm_group_reports_sent_shape", "status <> 'Sent' OR sent_at IS NOT NULL");
                    table.CheckConstraint("ck_crm_group_reports_status_allowed", "status IN ('Draft','Sent')");
                    table.ForeignKey(
                        name: "fk_crm_group_reports_author",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_crm_group_reports_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_crm_group_reports_author_id",
                table: "crm_group_reports",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_crm_group_reports_scope_status",
                table: "crm_group_reports",
                columns: new[] { "organization_id", "branch_id", "category_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ux_crm_group_reports_group_week",
                table: "crm_group_reports",
                columns: new[] { "organization_id", "crm_group_id", "week" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "crm_group_reports");
        }
    }
}

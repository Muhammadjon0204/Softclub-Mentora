using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MentorTaskFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CrmLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "crm_mentor_id",
                table: "users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "crm_branch_id",
                table: "branches",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_users_organization_crm_mentor",
                table: "users",
                columns: new[] { "organization_id", "crm_mentor_id" },
                unique: true,
                filter: "crm_mentor_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_branches_organization_crm_branch",
                table: "branches",
                columns: new[] { "organization_id", "crm_branch_id" },
                unique: true,
                filter: "crm_branch_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_users_organization_crm_mentor",
                table: "users");

            migrationBuilder.DropIndex(
                name: "ux_branches_organization_crm_branch",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "crm_mentor_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "crm_branch_id",
                table: "branches");
        }
    }
}

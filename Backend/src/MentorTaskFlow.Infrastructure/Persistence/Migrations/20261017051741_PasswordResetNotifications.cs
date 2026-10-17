using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MentorTaskFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PasswordResetNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_notification_outbox_branch_scope",
                table: "notification_outbox");

            migrationBuilder.AddCheckConstraint(
                name: "ck_notification_outbox_branch_scope",
                table: "notification_outbox",
                sql: "branch_id IS NOT NULL OR event_type IN ('BranchWithoutAdmin','NotificationDeadLetter','OrganizationSystemAlert','PasswordReset','PasswordResetTelegram','UserInvitation')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_notification_outbox_branch_scope",
                table: "notification_outbox");

            migrationBuilder.AddCheckConstraint(
                name: "ck_notification_outbox_branch_scope",
                table: "notification_outbox",
                sql: "branch_id IS NOT NULL OR event_type IN ('BranchWithoutAdmin','NotificationDeadLetter','OrganizationSystemAlert','UserInvitation')");
        }
    }
}

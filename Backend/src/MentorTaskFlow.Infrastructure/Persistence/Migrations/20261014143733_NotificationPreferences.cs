using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MentorTaskFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NotificationPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Everyone keeps receiving everything they received before: the switches start on, and
            // the default only fills the existing rows (the model has no database default — new users
            // get `true` from the entity itself).
            migrationBuilder.AddColumn<bool>(
                name: "notify_assignments_email",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_assignments_telegram",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_deadlines_email",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_deadlines_telegram",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_reviews_email",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_reviews_telegram",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_system_email",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_system_telegram",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "notify_assignments_email",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_assignments_telegram",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_deadlines_email",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_deadlines_telegram",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_reviews_email",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_reviews_telegram",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_system_email",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_system_telegram",
                table: "users");
        }
    }
}

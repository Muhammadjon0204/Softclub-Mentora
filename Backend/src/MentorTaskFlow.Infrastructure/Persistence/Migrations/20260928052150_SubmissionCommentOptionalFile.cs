using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MentorTaskFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SubmissionCommentOptionalFile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_extension_allowed",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_preview_key",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_sha256_format",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_size_bounds",
                table: "submissions");

            migrationBuilder.AlterColumn<string>(
                name: "storage_key",
                table: "submissions",
                type: "character varying(320)",
                maxLength: 320,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(320)",
                oldMaxLength: 320);

            migrationBuilder.AlterColumn<string>(
                name: "sha256_hash",
                table: "submissions",
                type: "char(64)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "char(64)");

            migrationBuilder.AlterColumn<string>(
                name: "original_file_name",
                table: "submissions",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255);

            migrationBuilder.AlterColumn<long>(
                name: "file_size_bytes",
                table: "submissions",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AlterColumn<string>(
                name: "file_extension",
                table: "submissions",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8);

            migrationBuilder.AlterColumn<string>(
                name: "content_type",
                table: "submissions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AddColumn<string>(
                name: "comment",
                table: "submissions",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_extension_allowed",
                table: "submissions",
                sql: "file_extension IS NULL OR file_extension IN ('Pdf','Pptx')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_file_fields_consistent",
                table: "submissions",
                sql: "(file_extension IS NULL AND storage_key IS NULL AND original_file_name IS NULL AND content_type IS NULL AND sha256_hash IS NULL) OR (file_extension IS NOT NULL AND storage_key IS NOT NULL AND original_file_name IS NOT NULL AND content_type IS NOT NULL AND sha256_hash IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_file_or_comment",
                table: "submissions",
                sql: "file_extension IS NOT NULL OR (comment IS NOT NULL AND length(trim(comment)) > 0)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_preview_key",
                table: "submissions",
                sql: "(file_extension = 'Pdf' AND preview_storage_key = storage_key) OR (file_extension = 'Pptx' AND preview_storage_key IS NULL) OR (file_extension IS NULL AND preview_storage_key IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_sha256_format",
                table: "submissions",
                sql: "sha256_hash IS NULL OR sha256_hash ~ '^[0-9a-f]{64}$'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_size_bounds",
                table: "submissions",
                sql: "file_size_bytes IS NULL OR (file_size_bytes > 0 AND file_size_bytes <= 52428800)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_extension_allowed",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_file_fields_consistent",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_file_or_comment",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_preview_key",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_sha256_format",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_submissions_size_bounds",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "comment",
                table: "submissions");

            migrationBuilder.AlterColumn<string>(
                name: "storage_key",
                table: "submissions",
                type: "character varying(320)",
                maxLength: 320,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(320)",
                oldMaxLength: 320,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "sha256_hash",
                table: "submissions",
                type: "char(64)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "char(64)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "original_file_name",
                table: "submissions",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255,
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "file_size_bytes",
                table: "submissions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "file_extension",
                table: "submissions",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "content_type",
                table: "submissions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_extension_allowed",
                table: "submissions",
                sql: "file_extension IN ('Pdf','Pptx')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_preview_key",
                table: "submissions",
                sql: "(file_extension = 'Pdf' AND preview_storage_key = storage_key) OR (file_extension = 'Pptx' AND preview_storage_key IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_sha256_format",
                table: "submissions",
                sql: "sha256_hash ~ '^[0-9a-f]{64}$'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submissions_size_bounds",
                table: "submissions",
                sql: "file_size_bytes > 0 AND file_size_bytes <= 52428800");
        }
    }
}

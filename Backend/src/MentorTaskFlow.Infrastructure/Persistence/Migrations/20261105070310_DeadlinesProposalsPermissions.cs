using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MentorTaskFlow.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Deadlines that can move, work handed out by administrators, mentors' proposals and permissions.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The two scope triggers are what really changes the model. Both compared the assigner and the
    /// reviewer with the assignment's category, which an administrator does not have, so the database
    /// refused anything an administrator handed out however the services were written. An administrator
    /// now passes if the work is in their contour; a Lead is held to the same exact match as before.
    /// </para>
    /// <para>
    /// <c>ck_assignments_due_order</c> is dropped rather than relaxed: a deadline may now be brought
    /// forward, so <c>current_due_at</c> can legitimately sit before <c>initial_due_at</c>.
    /// </para>
    /// </remarks>
    public partial class DeadlinesProposalsPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_audit_logs_branch_scope",
                table: "audit_logs");

            migrationBuilder.DropCheckConstraint(
                name: "ck_assignments_auto_fields",
                table: "assignments");

            migrationBuilder.DropCheckConstraint(
                name: "ck_assignments_due_order",
                table: "assignments");

            migrationBuilder.CreateTable(
                name: "proposals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    preferred_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    decided_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    decided_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    decision_comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    assignment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_proposals", x => x.id);
                    table.CheckConstraint("ck_proposals_decision_fields", "(status = 'Approved' AND assignment_id IS NOT NULL AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL)\nOR (status = 'Rejected' AND assignment_id IS NULL AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL\n    AND decision_comment IS NOT NULL)\nOR (status IN ('Pending','Withdrawn') AND assignment_id IS NULL AND decided_by_id IS NULL AND decided_at IS NULL)");
                    table.CheckConstraint("ck_proposals_kind_allowed", "kind IN ('MasterClass','ExtraLesson','Other')");
                    table.CheckConstraint("ck_proposals_status_allowed", "status IN ('Pending','Approved','Rejected','Withdrawn')");
                    table.ForeignKey(
                        name: "fk_proposals_assignment_scope",
                        columns: x => new { x.assignment_id, x.organization_id, x.branch_id, x.category_id },
                        principalTable: "assignments",
                        principalColumns: new[] { "id", "organization_id", "branch_id", "category_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_proposals_author",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_proposals_category_scope",
                        columns: x => new { x.category_id, x.organization_id, x.branch_id },
                        principalTable: "categories",
                        principalColumns: new[] { "id", "organization_id", "branch_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_proposals_decided_by",
                        column: x => x.decided_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    permission = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    allowed = table.Column<bool>(type: "boolean", nullable: false),
                    updated_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_role_permissions", x => x.id);
                    table.CheckConstraint("ck_role_permissions_subject_allowed", "subject IN ('BranchAdmin','Lead','Mentor')");
                    table.ForeignKey(
                        name: "fk_role_permissions_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_role_permissions_updated_by",
                        column: x => x.updated_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    permission = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    allowed = table.Column<bool>(type: "boolean", nullable: false),
                    updated_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_permissions", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_permissions_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_user_permissions_updated_by",
                        column: x => x.updated_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_user_permissions_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_audit_logs_branch_scope",
                table: "audit_logs",
                sql: "branch_id IS NOT NULL OR action IN ('ai.summary_generate','audit.read','bootstrap.provision','branch.activate','branch.create','branch.deactivate','branch.make_head_office','branch.update','organization.update','permission.role_update','report.organization_export','security.scope_override_rejected','storage.cross_scope_inconsistency','user.change_admin_scope','user.change_branch','user.create_organization_admin')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_assignments_auto_fields",
                table: "assignments",
                sql: "(source = 'Auto' AND generated_for_date IS NOT NULL AND auto_generation_key IS NOT NULL)\nOR (source IN ('Manual','Proposal') AND generated_for_date IS NULL AND auto_generation_key IS NULL)");

            migrationBuilder.CreateIndex(
                name: "ix_proposals_assignment_id_organization_id_branch_id_category_",
                table: "proposals",
                columns: new[] { "assignment_id", "organization_id", "branch_id", "category_id" });

            migrationBuilder.CreateIndex(
                name: "ix_proposals_author_created_at",
                table: "proposals",
                columns: new[] { "author_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_proposals_category_id_organization_id_branch_id",
                table: "proposals",
                columns: new[] { "category_id", "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_proposals_decided_by_id",
                table: "proposals",
                column: "decided_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_proposals_scope_status_created_at",
                table: "proposals",
                columns: new[] { "organization_id", "branch_id", "category_id", "status", "created_at" },
                descending: new[] { false, false, false, false, true });

            migrationBuilder.CreateIndex(
                name: "ix_role_permissions_updated_by_id",
                table: "role_permissions",
                column: "updated_by_id");

            migrationBuilder.CreateIndex(
                name: "ux_role_permissions_rule",
                table: "role_permissions",
                columns: new[] { "organization_id", "subject", "permission" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_permissions_organization_user",
                table: "user_permissions",
                columns: new[] { "organization_id", "user_id" });

            migrationBuilder.CreateIndex(
                name: "ix_user_permissions_updated_by_id",
                table: "user_permissions",
                column: "updated_by_id");

            migrationBuilder.CreateIndex(
                name: "ux_user_permissions_user_permission",
                table: "user_permissions",
                columns: new[] { "user_id", "permission" },
                unique: true);

            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION assignments_assert_executor_scope() RETURNS trigger AS $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.assigned_to_id
                          AND (u.organization_id <> NEW.organization_id
                            OR u.branch_id IS DISTINCT FROM NEW.branch_id
                            OR u.category_id IS DISTINCT FROM NEW.category_id))
                    THEN
                        RAISE EXCEPTION 'assignee is outside the scope of the assignment'
                            USING ERRCODE = '23503',
                                  CONSTRAINT = 'fk_assignments_assignee_scope',
                                  TABLE = 'assignments';
                    END IF;

                    IF NEW.assigned_by_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.assigned_by_id
                          AND (u.organization_id <> NEW.organization_id
                            OR (u.role = 'Admin' AND u.branch_id IS NOT NULL AND u.branch_id <> NEW.branch_id)
                            OR (u.role <> 'Admin' AND (u.branch_id IS DISTINCT FROM NEW.branch_id
                                                       OR u.category_id IS DISTINCT FROM NEW.category_id))))
                    THEN
                        RAISE EXCEPTION 'assigner is outside the scope of the assignment'
                            USING ERRCODE = '23503',
                                  CONSTRAINT = 'fk_assignments_assigner_scope',
                                  TABLE = 'assignments';
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                """);

            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION reviews_assert_reviewer_scope() RETURNS trigger AS $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.reviewer_id
                          AND (u.organization_id <> NEW.organization_id
                            OR (u.role = 'Admin' AND u.branch_id IS NOT NULL AND u.branch_id <> NEW.branch_id)
                            OR (u.role <> 'Admin' AND (u.branch_id IS DISTINCT FROM NEW.branch_id
                                                       OR u.category_id IS DISTINCT FROM NEW.category_id))))
                    THEN
                        RAISE EXCEPTION 'reviewer is outside the scope of the submission'
                            USING ERRCODE = '23503',
                                  CONSTRAINT = 'fk_reviews_reviewer_scope',
                                  TABLE = 'reviews';
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION assignments_assert_executor_scope() RETURNS trigger AS $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.assigned_to_id
                          AND (u.organization_id <> NEW.organization_id
                            OR u.branch_id IS DISTINCT FROM NEW.branch_id
                            OR u.category_id IS DISTINCT FROM NEW.category_id))
                    THEN
                        RAISE EXCEPTION 'assignee is outside the scope of the assignment'
                            USING ERRCODE = '23503',
                                  CONSTRAINT = 'fk_assignments_assignee_scope',
                                  TABLE = 'assignments';
                    END IF;

                    IF NEW.assigned_by_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.assigned_by_id
                          AND (u.organization_id <> NEW.organization_id
                            OR u.branch_id IS DISTINCT FROM NEW.branch_id
                            OR u.category_id IS DISTINCT FROM NEW.category_id))
                    THEN
                        RAISE EXCEPTION 'assigner is outside the scope of the assignment'
                            USING ERRCODE = '23503',
                                  CONSTRAINT = 'fk_assignments_assigner_scope',
                                  TABLE = 'assignments';
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                """);

            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION reviews_assert_reviewer_scope() RETURNS trigger AS $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.reviewer_id
                          AND (u.organization_id <> NEW.organization_id
                            OR u.branch_id IS DISTINCT FROM NEW.branch_id
                            OR u.category_id IS DISTINCT FROM NEW.category_id))
                    THEN
                        RAISE EXCEPTION 'reviewer is outside the scope of the submission'
                            USING ERRCODE = '23503',
                                  CONSTRAINT = 'fk_reviews_reviewer_scope',
                                  TABLE = 'reviews';
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                """);
            migrationBuilder.DropTable(
                name: "proposals");

            migrationBuilder.DropTable(
                name: "role_permissions");

            migrationBuilder.DropTable(
                name: "user_permissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_audit_logs_branch_scope",
                table: "audit_logs");

            migrationBuilder.DropCheckConstraint(
                name: "ck_assignments_auto_fields",
                table: "assignments");

            migrationBuilder.AddCheckConstraint(
                name: "ck_audit_logs_branch_scope",
                table: "audit_logs",
                sql: "branch_id IS NOT NULL OR action IN ('ai.summary_generate','audit.read','bootstrap.provision','branch.activate','branch.create','branch.deactivate','branch.make_head_office','branch.update','organization.update','report.organization_export','security.scope_override_rejected','storage.cross_scope_inconsistency','user.change_admin_scope','user.change_branch','user.create_organization_admin')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_assignments_auto_fields",
                table: "assignments",
                sql: "(source = 'Auto' AND generated_for_date IS NOT NULL AND auto_generation_key IS NOT NULL)\r\nOR (source = 'Manual' AND generated_for_date IS NULL AND auto_generation_key IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_assignments_due_order",
                table: "assignments",
                sql: "current_due_at >= initial_due_at");
        }
    }
}

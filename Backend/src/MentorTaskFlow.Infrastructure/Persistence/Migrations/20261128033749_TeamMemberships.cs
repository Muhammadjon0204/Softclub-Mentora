using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MentorTaskFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TeamMemberships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "team_memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    added_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_team_memberships", x => x.id);
                    table.CheckConstraint("ck_team_memberships_role_allowed", "role IN ('Lead','Mentor','Member')");
                    table.ForeignKey(
                        name: "fk_team_memberships_added_by",
                        column: x => x.added_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_team_memberships_category_scope",
                        columns: x => new { x.category_id, x.organization_id, x.branch_id },
                        principalTable: "categories",
                        principalColumns: new[] { "id", "organization_id", "branch_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_team_memberships_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_team_memberships_added_by_id",
                table: "team_memberships",
                column: "added_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_team_memberships_category_id_organization_id_branch_id",
                table: "team_memberships",
                columns: new[] { "category_id", "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_team_memberships_organization_branch_category",
                table: "team_memberships",
                columns: new[] { "organization_id", "branch_id", "category_id" });

            migrationBuilder.CreateIndex(
                name: "ux_team_memberships_user_category",
                table: "team_memberships",
                columns: new[] { "user_id", "category_id" },
                unique: true);

            // Work may now be given to, issued by and reviewed by anybody who belongs to its team. The
            // assigner is judged when they are named: somebody who has since left the team must not
            // stop the next lead from reassigning the task they handed out.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION assignments_assert_executor_scope() RETURNS trigger AS $$
                DECLARE assigner_named boolean := TG_OP = 'INSERT';
                BEGIN
                    IF TG_OP = 'UPDATE' THEN
                        assigner_named := NEW.assigned_by_id IS DISTINCT FROM OLD.assigned_by_id;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.assigned_to_id
                          AND (u.organization_id <> NEW.organization_id
                            OR u.branch_id IS DISTINCT FROM NEW.branch_id
                            OR (u.category_id IS DISTINCT FROM NEW.category_id
                                AND NOT EXISTS (SELECT 1 FROM team_memberships m
                                                WHERE m.user_id = u.id AND m.category_id = NEW.category_id))))
                    THEN
                        RAISE EXCEPTION 'assignee is outside the scope of the assignment'
                            USING ERRCODE = '23503',
                                  CONSTRAINT = 'fk_assignments_assignee_scope',
                                  TABLE = 'assignments';
                    END IF;

                    IF assigner_named AND NEW.assigned_by_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = NEW.assigned_by_id
                          AND (u.organization_id <> NEW.organization_id
                            OR (u.role = 'Admin' AND u.branch_id IS NOT NULL AND u.branch_id <> NEW.branch_id)
                            OR (u.role <> 'Admin' AND (u.branch_id IS DISTINCT FROM NEW.branch_id
                                                       OR (u.category_id IS DISTINCT FROM NEW.category_id
                                AND NOT EXISTS (SELECT 1 FROM team_memberships m
                                                WHERE m.user_id = u.id AND m.category_id = NEW.category_id))))))
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
                                                       OR (u.category_id IS DISTINCT FROM NEW.category_id
                                AND NOT EXISTS (SELECT 1 FROM team_memberships m
                                                WHERE m.user_id = u.id AND m.category_id = NEW.category_id))))))
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

            // «One active lead per team» across both ways of leading it: the account's own team
            // (ux_users_active_lead_per_category still covers that pair) and a membership. The advisory
            // lock makes two concurrent appointments wait for each other.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION assert_team_has_one_lead(team uuid, subject uuid) RETURNS void AS $$
                BEGIN
                    PERFORM pg_advisory_xact_lock(hashtext(team::text));

                    IF EXISTS (SELECT 1 FROM users u
                               WHERE u.is_active AND u.role = 'Lead' AND u.category_id = team AND u.id <> subject)
                       OR EXISTS (SELECT 1 FROM team_memberships m JOIN users u ON u.id = m.user_id
                                  WHERE m.category_id = team AND m.role = 'Lead' AND u.is_active AND m.user_id <> subject)
                    THEN
                        RAISE EXCEPTION 'the team already has an active lead'
                            USING ERRCODE = '23505',
                                  CONSTRAINT = 'ux_users_active_lead_per_category';
                    END IF;
                END;
                $$ LANGUAGE plpgsql;

                CREATE OR REPLACE FUNCTION users_assert_single_lead() RETURNS trigger AS $$
                DECLARE membership record;
                BEGIN
                    IF NOT NEW.is_active THEN
                        RETURN NEW;
                    END IF;

                    IF NEW.role = 'Lead' THEN
                        PERFORM assert_team_has_one_lead(NEW.category_id, NEW.id);
                    END IF;

                    -- Reactivating somebody brings their other leaderships back with them.
                    FOR membership IN SELECT category_id FROM team_memberships WHERE user_id = NEW.id AND role = 'Lead' LOOP
                        PERFORM assert_team_has_one_lead(membership.category_id, NEW.id);
                    END LOOP;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE OR REPLACE FUNCTION team_memberships_assert_single_lead() RETURNS trigger AS $$
                BEGIN
                    IF NEW.role = 'Lead' AND EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND is_active) THEN
                        PERFORM assert_team_has_one_lead(NEW.category_id, NEW.user_id);
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER trg_users_single_lead
                  BEFORE INSERT OR UPDATE OF role, category_id, is_active ON users
                  FOR EACH ROW EXECUTE FUNCTION users_assert_single_lead();

                CREATE TRIGGER trg_team_memberships_single_lead
                  BEFORE INSERT OR UPDATE OF role, user_id, category_id ON team_memberships
                  FOR EACH ROW EXECUTE FUNCTION team_memberships_assert_single_lead();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS trg_users_single_lead ON users;
                DROP TRIGGER IF EXISTS trg_team_memberships_single_lead ON team_memberships;
                DROP FUNCTION IF EXISTS users_assert_single_lead();
                DROP FUNCTION IF EXISTS team_memberships_assert_single_lead();
                DROP FUNCTION IF EXISTS assert_team_has_one_lead(uuid, uuid);
                """);

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

            migrationBuilder.DropTable(
                name: "team_memberships");
        }
    }
}

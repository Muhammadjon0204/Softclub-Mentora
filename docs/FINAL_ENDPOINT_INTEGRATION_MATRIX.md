# FINAL ENDPOINT INTEGRATION MATRIX

Source of truth for every row: live `GET /swagger/v1/swagger.json` (79 = 77 documented routes + 2 undocumented health routes), all 14 backend controllers read in full, all `Frontend/src/api/**/*.ts` files read in full, systematic grep for zero-caller API client functions, cross-checked against the project's own `docs/INTEGRATION_UI_ISSUES.md` (verified against current code, not trusted blindly — several of its entries are now stale/already-resolved and are marked as such below).

Status definitions (mutually exclusive — every endpoint gets exactly one):
- **LIVE_VERIFIED** — reachable from a routed frontend page AND I personally issued this exact HTTP request against the running stack this session and confirmed the response/DB effect.
- **CONNECTED_NOT_LIVE_VERIFIED** — real frontend code calls it from a reachable page, but I did not personally fire this exact request this session.
- **PARTIAL** — reachable and wired from some UI entry points but not others (documented per-row which).
- **MOCKED** — a routed page displays data for this domain from a mock/fixture source instead of (or alongside) this endpoint. (None remain after this session's fixes — see notes.)
- **BACKEND_ONLY** — the backend endpoint works (in several rows, verified live by direct curl) but zero frontend code path reaches it, OR a client-wrapper function exists but has zero callers anywhere in the app (verified by grep).
- **DEAD_CODE** — not used for any row in this table (no backend endpoint is itself unreachable; frontend dead code is listed separately in the audit summary).
- **BLOCKED** — could not be assessed due to an environment constraint. (0 rows — Docker/Postgres/MinIO/Mailhog were available for the entire session.)

| # | Method | Route | Backend Module | Frontend Caller | Reachable Page | Status | Live HTTP Status | DB/Storage Verified | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | POST | /auth/login | AuthController | `api/auth.ts` (via `api/generated/auth-api.ts`) | LoginPage.tsx | **LIVE_VERIFIED** | 200 ×5 (all 5 real accounts, 2 sessions) | JWT claims decoded, match `users` table | — |
| 2 | POST | /auth/refresh | AuthController | `auth/refreshCoordinator.ts` | automatic on 401 | **LIVE_VERIFIED** | 403 (no CSRF) → 200 (with CSRF) | `refresh_tokens`: old row `revoked_at` set, new row inserted | Confirmed real double-submit CSRF + rotation |
| 3 | POST | /auth/logout | AuthController | `api/auth.ts` | logout button | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 4 | GET | /auth/me | AuthController | `auth/AuthProvider.tsx` | every authenticated page | **LIVE_VERIFIED** | 200 ×2 (Org Admin, Branch Admin) | matches `users` row | — |
| 5 | POST | /auth/change-password | AuthController | `api/auth.ts` | account/security settings | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 6 | POST | /auth/forgot-password | AuthController | `api/auth.ts` | "Забыли пароль" link | CONNECTED_NOT_LIVE_VERIFIED | — | — | Reset link only logged server-side, never emailed (`docs/INTEGRATION_UI_ISSUES.md` #19 "Related, NOT fixed") — real backend gap, not frontend wiring |
| 7 | POST | /auth/reset-password | AuthController | ResetPasswordPage | reset-password flow | CONNECTED_NOT_LIVE_VERIFIED | — | — | Covered by vitest (MSW), not live |
| 8 | POST | /auth/set-password | AuthController | SetPasswordPage | invitation flow | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 9 | GET | /organization | OrganizationController | `api/admin/organization.ts` | SettingsPage.tsx | **LIVE_VERIFIED** | 200 | matches `organizations` row | — |
| 10 | PUT | /organization | OrganizationController | `api/admin/organization.ts` | SettingsPage.tsx | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 11 | GET | /branches | BranchesController | `api/admin/branches.ts` (`listBranchesDetailed`) | BranchesPage.tsx | **LIVE_VERIFIED** | 200, totalCount:2 | matches `SELECT count(*) FROM branches` = 2 | — |
| 12 | GET | /branches/{id} | BranchesController | `api/admin/branches.ts` (`getBranch`) | own-branch view (non-OrgAdmin) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 13 | POST | /branches | BranchesController | `useBranchActions.createBranch` | BranchFormDrawer (create) | CONNECTED_NOT_LIVE_VERIFIED | — | — | Admin-picker in this form fixed this session (was mock `useUsersPreview()` → real `useUsersQuery()`); the create-with-admin assignment itself is still an intentional no-op, see row 20 |
| 14 | PUT | /branches/{id} | BranchesController | `useBranchActions.updateBranch` | BranchFormDrawer (edit) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 15 | POST | /branches/{id}/activate | BranchesController | `useBranchActions.activateBranch` | ActivateBranchDialog | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 16 | POST | /branches/{id}/deactivate | BranchesController | `useBranchActions.deactivateBranch` | DeactivateBranchDialog | CONNECTED_NOT_LIVE_VERIFIED | — | — | Always sends `confirmActiveUsers:false`, no escalation step on 409 `BRANCH_HAS_ACTIVE_USERS` — real, still-open gap (`INTEGRATION_UI_ISSUES.md` #3, verified still true in current code) |
| 17 | POST | /branches/{id}/make-head-office | BranchesController | `api/admin/branches.ts` (`makeHeadOfficeBranch`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Client wrapper defined, zero callers (verified by grep) — no menu item anywhere calls it (`INTEGRATION_UI_ISSUES.md` #2, confirmed still true) |
| 18 | GET | /users | UsersController | `api/admin/users.ts` (`listUsers`) | UsersPage.tsx, + reused by Branches/Categories/Team pages | **LIVE_VERIFIED** | 200, totalCount:5 | matches `SELECT count(*) FROM users` = 5 | This session's fix repointed Lead Dashboard/Reports mentor-widgets to this endpoint (were reading a disconnected mock store, see summary doc) |
| 19 | GET | /users/{id} | UsersController | `api/admin/users.ts` (`getUser`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers (verified by grep) — every page resolves a user by `.find()` on the already-fetched list instead |
| 20 | POST | /users | UsersController | `api/admin/users.ts` (`createUser`) | UserForm.tsx (create), `useTeamActions.createMentor` (Lead "Добавить ментора") | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 21 | PATCH | /users/{id} | UsersController | `api/admin/users.ts` (`patchUser`) | UserForm.tsx (edit name) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 22 | POST | /users/{id}/activate | UsersController | `useUserActions.activateUser` | referenced only in `DeactivateUserDialog.tsx`/mock store | **PARTIAL** | — | — | No menu item calls it for an already-deactivated user (`INTEGRATION_UI_ISSUES.md` #7, confirmed still true) — real capability, unreachable in the one state where it would matter |
| 23 | POST | /users/{id}/deactivate | UsersController | `useUserActions.deactivateUser` | DeactivateUserDialog.tsx | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 24 | POST | /users/{id}/change-role | UsersController | `api/admin/users.ts` (`changeUserRole`) | `useUserActions.changeRole` (ChangeUserRoleDialog), `useCategoryActions` (Assign/Change category lead), `useBranchActions` (Assign/Change branch admin — **fixed this session**) | **PARTIAL** | — | — | Wired and correct from 2 of 3 realistic entry points; the 3rd (assign-admin-during-branch-creation, row 13) still a documented no-op — see summary doc gap list |
| 25 | POST | /users/{id}/change-category | UsersController | `api/admin/users.ts` (`changeUserCategory`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers (verified by grep) — no standalone "change category without role change" UI exists (documented, intentional per `INTEGRATION_UI_ISSUES.md`) |
| 26 | POST | /users/{id}/change-branch | UsersController | `api/admin/users.ts` (`changeUserBranch`) | `useUserActions.transferUser` (TransferUserDialog) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 27 | POST | /users/{id}/resend-invitation | UsersController | `useUserActions.resendInvitation` | UserSecuritySection.tsx | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 28 | GET | /categories | CategoriesController | `api/admin/categories.ts` (`listCategories`) | CategoriesPage.tsx, + reused widely | **LIVE_VERIFIED** | 200, totalCount:1 | matches `SELECT count(*) FROM categories` = 1 (real "C#") | — |
| 29 | GET | /categories/{id} | CategoriesController | `api/admin/categories.ts` (`getCategory`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers (verified by grep) |
| 30 | POST | /categories | CategoriesController | `useCategoryActions.createCategory` | CategoryFormDrawer (create) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 31 | PUT | /categories/{id} | CategoriesController | `useCategoryActions.updateCategory` | CategoryFormDrawer (edit) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 32 | POST | /categories/{id}/activate | CategoriesController | `useCategoryActions.activateCategory` | ActivateCategoryDialog | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 33 | POST | /categories/{id}/deactivate | CategoriesController | `useCategoryActions.deactivateCategory` | DeactivateCategoryDialog | CONNECTED_NOT_LIVE_VERIFIED | — | — | Same escalation gap as row 16, category side (`INTEGRATION_UI_ISSUES.md` #5, confirmed still true) |
| 34 | GET | /categories/{id}/settings | CategoriesController | `api/admin/categories.ts` (`getCategorySettings`) | CategorySettingsSection.tsx | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 35 | PUT | /categories/{id}/settings | CategoriesController | `api/admin/categories.ts` (`updateCategorySettings`) | CategorySettingsSection.tsx | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 36 | GET | /assignments | AssignmentsController | `api/lead/assignments.ts` (`listAssignments`) | Lead Assignments/Kanban, Mentor Assignments/Kanban, Lead/Mentor Dashboard+Reports (client-computed) | **LIVE_VERIFIED** | 200 (empty→1→2 items across test cycles) | matches `assignments` table exactly at every step | — |
| 37 | GET | /assignments/{id} | AssignmentsController | `api/lead/assignments.ts` (`getAssignment`) | Lead/Mentor assignment detail drawers, `useReviewActions` follow-up read | **LIVE_VERIFIED** | 200 (status field tracked through full lifecycle) | — | — |
| 38 | GET | /assignments/{id}/history | AssignmentsController | `api/lead/assignments.ts` (`getAssignmentHistory`) | history tabs, `useMentorNotifications` | **LIVE_VERIFIED** | 200, 5 then 8 events in order | matches `task_events` count exactly | Found+fixed a real backend bug here this session (see summary doc): `ActorLabel` masking |
| 39 | POST | /assignments/drafts | AssignmentsController | `api/lead/assignments.ts` (`createAssignmentDraft`) | AssignmentForm.tsx | **LIVE_VERIFIED** | 201 ×2 | 2 real rows created and later cleaned up | — |
| 40 | PUT | /assignments/{id} | AssignmentsController | `api/lead/assignments.ts` (`updateAssignment`) | AssignmentForm.tsx (edit) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 41 | POST | /assignments/{id}/publish | AssignmentsController | `api/lead/assignments.ts` (`publishAssignment`) | AssignmentsKanbanBoard/Page | **LIVE_VERIFIED** | 200 ×2, Draft→Assigned | — | — |
| 42 | POST | /assignments/{id}/accept-suggestion | AssignmentsController | `api/lead/assignments.ts` (`acceptSuggestion`) | SuggestionsPage.tsx | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 43 | POST | /assignments/{id}/reassign | AssignmentsController | `api/lead/assignments.ts` (`reassignAssignment`) | ReassignAssignmentDialog | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 44 | POST | /assignments/{id}/start-review | AssignmentsController | `api/lead/assignments.ts` (`startReview`) | ReviewQueuePage/ReviewWorkspaceDrawer | **LIVE_VERIFIED** | 200 ×2, →InReview | — | — |
| 45 | POST | /assignments/{id}/cancel | AssignmentsController | `api/lead/assignments.ts` (`cancelAssignment`) | AssignmentsKanbanBoard/Page (cancel action) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 46 | POST | /assignments/{id}/submissions | SubmissionsController | `api/lead/submissions.ts` (`uploadSubmission`) | `useSubmitAssignment.ts` (Mentor "Отправить на проверку") | **LIVE_VERIFIED** | 415 (wrong type, real validation) → 201 ×3 (v1, rework-v1, rework-v2) | 3 real `submissions` rows, real SHA-256, real MinIO objects | — |
| 47 | GET | /assignments/{id}/submissions | SubmissionsController | `api/lead/submissions.ts` (`listSubmissions`) | LeadAssignmentDetailsDrawer, ReviewWorkspaceDrawer | **LIVE_VERIFIED** | 200 | matches inserted rows | — |
| 48 | GET | /submissions/{id}/download-url | SubmissionsController | `api/lead/submissions.ts` (`getDownloadUrl`) | file download buttons | **LIVE_VERIFIED** | 200 | Presigned URL fetched — 312 bytes `application/pdf` byte-identical to upload | — |
| 49 | GET | /submissions/{id}/preview-url | SubmissionsController | `api/lead/submissions.ts` (`getPreviewUrl`) | inline PDF preview | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 50 | POST | /submissions/{id}/reviews | ReviewsController | `api/lead/reviews.ts` (`createReview`) via `useReviewActions` | ReviewWorkspaceDrawer (Approve / Needs Rework) | **LIVE_VERIFIED** | 500 (real crash found) → fixed → 400 (clean validation) → 201 ×2 (NeedsRework, Approved) | 2 real `reviews` rows | **Real P0 bug found and fixed this session** — see summary doc |
| 51 | GET | /submissions/{id}/review | ReviewsController | `api/lead/reviews.ts` (`getReview`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers (verified by grep) — review outcome is read from the mutation's own response / task-event history instead |
| 52 | GET | /topics | TopicsController | `api/lead/topics.ts` (`listTopics`) | Lead/Mentor Schedule pages | **LIVE_VERIFIED** | 200, 0→1 items | matches `topics` table | — |
| 53 | GET | /topics/{id} | TopicsController | `api/lead/topics.ts` (`getTopic`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers (verified by grep) — resolved via `.find()` on the list instead |
| 54 | POST | /topics | TopicsController | `api/lead/topics.ts` (`createTopic`) | TopicFormDrawer (create) | **LIVE_VERIFIED** | 201 | 1 real row created, later cleaned up | — |
| 55 | PUT | /topics/{id} | TopicsController | `api/lead/topics.ts` (`updateTopic`) | TopicFormDrawer (edit) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 56 | POST | /topics/{id}/activate | TopicsController | `useTopicActions.activateTopic` exists | **nowhere** | **BACKEND_ONLY** | — | — | No button calls it (`INTEGRATION_UI_ISSUES.md` #11, confirmed) |
| 57 | POST | /topics/{id}/deactivate | TopicsController | `useTopicActions.deactivateTopic` exists | **nowhere** | **BACKEND_ONLY** | — | — | Same as row 56 |
| 58 | DELETE | /topics/{id} | TopicsController | `api/lead/topics.ts` (`deleteTopic`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers — codebase's own comment admits "no UI trigger wired" (`INTEGRATION_UI_ISSUES.md` #10) |
| 59 | GET | /topics/{topicId}/assignments | TopicsController | `api/lead/topics.ts` (`listTopicAssignmentsOfTopic`) | TopicDetailsDrawer, `useAllTopicAssignments` | CONNECTED_NOT_LIVE_VERIFIED | — | — | Created via row 60 this session but the corresponding GET was not separately re-issued |
| 60 | POST | /topics/{topicId}/assignments | TopicsController | `api/lead/topics.ts` (`createTopicAssignment`) | TopicAssignmentFormModal | **LIVE_VERIFIED** | 400 (real validation on `type`) → 201 | 1 real row created, later cleaned up | — |
| 61 | GET | /topic-assignments/{id} | TopicAssignmentsController | `api/lead/topicAssignments.ts` (`getTopicAssignment`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers (verified by grep) |
| 62 | PUT | /topic-assignments/{id} | TopicAssignmentsController | `useTopicAssignmentActions.updateTopicAssignment` | TopicAssignmentFormModal (edit) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 63 | POST | /topic-assignments/{id}/activate | TopicAssignmentsController | `useTopicAssignmentActions.activateTopicAssignment` | TopicDetailsDrawer (restore) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 64 | POST | /topic-assignments/{id}/deactivate | TopicAssignmentsController | `useTopicAssignmentActions.deactivateTopicAssignment` | TopicDetailsDrawer (archive) | CONNECTED_NOT_LIVE_VERIFIED | — | — | — |
| 65 | DELETE | /topic-assignments/{id} | TopicAssignmentsController | `api/lead/topicAssignments.ts` (`deleteTopicAssignment`) exists | **nowhere** | **BACKEND_ONLY** | — | — | Zero callers — same codebase comment as row 58 explicitly names this one too |
| 66 | GET | /admin/dashboard | AdminDashboardController | `api/admin/dashboard.ts` (`useDashboardQuery`) | Admin Dashboard, **admin ReportsPage.tsx**, **HealthPage.tsx** | **LIVE_VERIFIED** | 200 ×2, differing health-check latencies between calls | `systemHealth` genuinely calls `HealthCheckService` (confirmed in `AdminDashboardService.cs`) | Admin "Отчёты" page repurposes this endpoint instead of the real Reports domain (rows 74-77) — not mock, but not the intended domain either |
| 67 | GET | /admin/audit-log | AdminAuditLogController | inline `apiClient` call in `AuditPage.tsx` (no dedicated `api/*.ts` — verified this is a real call, not a gap) | AuditPage.tsx | **LIVE_VERIFIED** | 200, 6 items | matches `SELECT count(*) FROM audit_logs` | — |
| 68 | GET | /admin/notifications | NotificationsController | inline `apiClient` call in `NotificationsPage.tsx` | NotificationsPage.tsx | **LIVE_VERIFIED** | 200, 0→3 items across test cycle | matches `notification_outbox` count at every step | — |
| 69 | POST | /admin/notifications/{id}/retry | NotificationsController | none found | **nowhere** | **BACKEND_ONLY** | — | — | `NotificationsPage.tsx` has no retry button/action wired |
| 70 | GET | /reports/personal | ReportsController | none found | **nowhere** | **BACKEND_ONLY** | — | — | Zero references anywhere in `Frontend/src` |
| 71 | GET | /reports/team | ReportsController | none found | **nowhere** | **BACKEND_ONLY** | — | — | Zero references anywhere in `Frontend/src` |
| 72 | GET | /reports/branches | ReportsController | none found | **nowhere** | **BACKEND_ONLY** | 200 (tested directly, standalone) | valid `ReportDto` returned | Backend works correctly in isolation — frontend simply never calls it |
| 73 | POST | /reports/ai-summary | ReportsController | none found | **nowhere** | **BACKEND_ONLY** | — | — | Lead/Mentor "ИИ-резюме" modals compute text client-side from already-fetched numbers instead of calling this |
| 74 | POST | /telegram/bind-token | TelegramController | none found | **nowhere** | **BACKEND_ONLY** | — | — | No Settings/profile UI surface for Telegram anywhere |
| 75 | GET | /telegram/status | TelegramController | none found | **nowhere** | **BACKEND_ONLY** | 404 (tested directly — real "no binding" response, feature is enabled) | — | — |
| 76 | DELETE | /telegram/binding | TelegramController | none found | **nowhere** | **BACKEND_ONLY** | — | — | — |
| 77 | POST | /telegram/webhook | TelegramController | N/A — bot-facing, not a frontend page | N/A | **BACKEND_ONLY** | — | — | By design; not an integration gap |
| 78 | GET | /health/live | Program.cs (`MapHealthChecks`) | none (not an app data source) | N/A — infra probe | **LIVE_VERIFIED** | 200 `{"status":"Healthy"}` | — | Infra-only, correctly outside `/api/v1` and outside Swagger |
| 79 | GET | /health/ready | Program.cs (`MapHealthChecks`) | none | N/A — infra probe | **LIVE_VERIFIED** | 200 `{"status":"Degraded"}` (ai provider genuinely unconfigured) | postgres/storage checks match `/admin/dashboard`'s own health block | — |

## Count reconciliation

| Status | Count |
|---|---:|
| LIVE_VERIFIED | 25 |
| CONNECTED_NOT_LIVE_VERIFIED | 32 |
| PARTIAL | 2 |
| MOCKED | 0 |
| BACKEND_ONLY | 20 |
| DEAD_CODE | 0 |
| BLOCKED | 0 |
| **TOTAL** | **79** |

25 + 32 + 2 + 0 + 20 + 0 + 0 = **79** ✅ — mechanically recounted by grepping the exact status token in each of the 79 data rows (not eyeballed), confirmed every row carries exactly one status.

**MOCKED = 0** because every mock/fixture-sourced UI surface found during this engagement (Lead Dashboard/Reports mentor widgets, branch-create admin picker, branch metrics/deactivate counters) was fixed to call the real endpoint listed above, in this session or the immediately preceding one — see `docs/FINAL_FRONTEND_INTEGRATION_AUDIT.md` for the fix list and evidence. This does **not** mean "no mocks exist in the repo" — it means no *reachable, routed* page currently renders mock data in place of a real call. Orphaned/unreachable mock files remain in the tree and are listed in the summary doc.

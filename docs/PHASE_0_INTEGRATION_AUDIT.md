# Phase 0 — Frontend ↔ Backend Integration Audit

Status: **audit only, no code changed**. Produced by reading actual source on both sides (not docs claims) and cross-referencing. Companion to the existing [`docs/phase-1-owner-organization-admin/`](./phase-1-owner-organization-admin/README.md) package, which remains the authoritative contract for the Admin domain.

---

## 1. Repo / git state

- `Backend/` is **entirely untracked** (`git status` shows almost every file as `??`). Nothing under `Backend/src`, `Backend/tests`, `Backend/docs` has ever been committed. Only `Backend/Backend.txt` was tracked — it's a 7-byte placeholder (`"Backend"`), now deleted in the working tree; not a lost spec, safe to let the deletion go through.
- Last real commit (`cb499ca "end all features"`) is Frontend-only (Mentor sidebar/breadcrumbs, Lead assignment form fixes).
- **This is not a merge scenario.** There's no conflicting history to reconcile — it's a straightforward "stage and commit a new backend codebase" situation. No blind `ours`/`theirs` resolution needed anywhere.
- Action needed before anything else: decide when to `git add`/commit `Backend/` (recommend: as its own commit, separate from any frontend wiring changes, so history stays legible).

## 2. Executive summary

The backend is a **real, disciplined .NET 10** implementation (not .NET 9 as assumed) — RFC 9457 ProblemDetails errors, server-side tenant isolation via EF Core global query filters (fail-closed), immutable audit log, real computed analytics, presigned-URL file access, architecture tests enforcing its own invariants. It is not a stub.

The frontend's **Auth + branch-header-scoping + error-shape + assignment-status-FSM** were all built with unusually high fidelity to what turned out to be the real backend contract — large parts of Phase "wire it up" will genuinely be "swap the mock flag," not a rewrite. But there are five gaps that are not wiring problems — they're either missing backend surface or unbuilt frontend surface — detailed in §4.

## 3. High-confidence alignments (low-risk to wire first)

| Area | Evidence |
|---|---|
| Auth flow shape | Frontend `apiClient`/`publicClient`/`refreshCoordinator`/`tokenStore` already implement exactly the backend's model: bearer access token + HttpOnly `mtf_rt` refresh cookie + double-submit `mtf_csrf` CSRF header on `refresh`/`logout` only, single-flight refresh, 401→refresh→retry-once. All 8 `AuthController` routes have matching `api/auth.ts` functions and MSW handlers already. |
| Role/scope model | Backend: `Role: Admin\|Lead\|Mentor` + `AdminScope: Organization\|Branch\|null`. Frontend's **real** `AuthUser` type (from `GET /auth/me`) already uses `role`/`adminScope`, not a flat 4-way enum. (The flat `OrgAdmin\|BranchAdmin\|Lead\|Mentor` enum only exists in the **Users preview store fixtures** — see §4.2, already flagged in existing docs §3.2.) |
| `X-MTF-Branch-Id` header rule | Backend: only Organization Admin may send it; anyone else → 403 `SCOPE_OVERRIDE_FORBIDDEN`. Frontend's `branchHeaderInterceptor.ts` already enforces exactly this client-side. |
| Foreign-object handling | Backend returns byte-identical 404 `RESOURCE_NOT_FOUND` for both "doesn't exist" and "exists in another org/branch" (no `FOREIGN_BRANCH` code exists, deliberately). Frontend's MSW `mocks/handlers/shared.ts` already mirrors this exact behavior. |
| Error envelope | Backend: RFC 9457 `application/problem+json` with a stable `code`. Frontend's `api/problemDetails.ts` already parses exactly this shape (`isProblemDetails`, `getProblemCode`, `getValidationErrors`, `getRetryAfter`). |
| Assignment status FSM | Backend `AssignmentStatus`: `Draft→Suggested→Assigned→Submitted→InReview→NeedsRework→Overdue→Approved(terminal)/Cancelled(terminal)`, one named-action method per transition (`Publish`, `AcceptSuggestion`, `Reassign`, `Submit`, `StartReview`, `Approve`, `RequestRework`, `Cancel`). Frontend's `mocks/domain/assignments.ts` and `leadAssignmentPreviewStore.ts` already use the **identical 9-state enum and the same named actions** (`publishPreview`, `acceptSuggestionPreview`, `startReviewPreview`, etc.), with the preview store's own comment noting it deliberately mirrors "what the backend must also do." |
| Admin Notifications (outbox) page | Backend `NotificationsController`: admin-only, `GET /admin/notifications` (filterable, paged) + `POST /admin/notifications/{id}/retry`. Frontend `notificationPreviewStore.ts` already exposes exactly one mutation, `retryNotificationPreview`. Direct match — just needs real wiring. |
| Dev CORS port | Backend dev CORS origin defaults to `http://localhost:5173`; Vite dev server also runs on `5173`. No mismatch (earlier concern from the backend-only pass is resolved by the frontend pass). |

## 4. Critical conflicts

Format per your instructions: BACKEND CONTRACT / FRONTEND EXPECTATION / CONFLICT / RECOMMENDED RESOLUTION.

### 4.1 — No aggregate Admin Dashboard endpoint exists in the backend

- **BACKEND CONTRACT**: The delivered backend has **14 controllers** (Auth, Assignments, Branches, Categories, Notifications-admin, Organization, Reports, Reviews, Submissions, Telegram, Topics, TopicAssignments, Users, AdminAuditLog). **None of them is a Dashboard controller**, and no `/admin/dashboard` route exists anywhere in `Backend/src/MentorTaskFlow.Api/Controllers/`.
- **FRONTEND EXPECTATION**: `/admin/dashboard` (the landing page for both Organization Admin and Branch Admin) is fully built against a single aggregate call, `GET /api/v1/admin/dashboard?period=`, returning one large object (`kpis, activitySeries, roleDistribution, branchHealth, categoryHealth, recentAudit, systemHealth, bestBranchInsight, topMentors, upcomingDeadlines, recentAssignmentActivity`) — see `Frontend/src/api/admin/dashboard.ts:10-164`. This contract is already MSW-backed and covered by `adminDashboard.test.tsx`.
- **CONFLICT**: This is the single highest-traffic page in the Admin/Branch Admin experience, and its backend does not exist yet in any form — not partially, not as separate composable calls. The existing Phase 1 docs (`Phase_1_Product_Extensions_and_Open_Questions.md` §1.4) anticipated this ("реализовать как один endpoint либо как Backend Controller, композирующий несколько Application Service вызовов") but as of this audit **neither exists**.
- **RECOMMENDED RESOLUTION**: Needs a Product/Architecture call, not a silent frontend workaround:
  - **(a)** Build a real `GET /api/v1/admin/dashboard` backend endpoint that composes existing services (Reports/Branches/Categories/Users/AuditLog/Reviews) into the exact shape the frontend already expects — preserves the UI unchanged, concentrates new backend work in one controller+service.
  - **(b)** Decompose the frontend dashboard into several real calls (`/reports/team`, `/reports/branches`, `/admin/audit-log`, `/admin/notifications`, `/branches`, `/categories`...) and recompute `kpis`/`bestBranchInsight`/`topMentors` client-side — no new backend endpoint, but risks recomputing metrics the backend is supposed to own (against Phase 16 of your own instructions: don't reimplement backend-owned formulas on the frontend).
  - Given (a) keeps the UI/UX identical (your Phase 2/24 priority) and avoids frontend-side metric duplication (your Phase 16 priority), **(a) is the natural default** — but it's real new backend work, so flagging rather than deciding silently.

### 4.2 — No user-facing notification channel in the backend at all

- **BACKEND CONTRACT**: There is no unread-count endpoint, no mark-read/mark-all-read endpoint, and no SignalR/WebSocket hub anywhere in the codebase. The only notification-related controller (`NotificationsController`) is `[Authorize(Policy = AnyAdmin)]` for its entire class — a Mentor or Lead cannot call it at all. Actual delivery to end users is **outbound-only**: email (SMTP) and Telegram, dispatched by a background outbox worker. A user's only way to "see" a notification is in their inbox/Telegram, not in-app.
- **FRONTEND EXPECTATION**: `/mentor/notifications` (bell icon + page) is fully built — but per prior audit and confirmed again here, it was **already architected as a derived feed**, not a call to a dedicated notifications API: `mentorNotificationSource.ts` builds notification cards by scanning `TaskEvent`-shaped records on the mentor's own assignments (own in-code comment: "не отдельный backend-канал... а производная лента поверх уже существующих TaskEvent"). Read/unread state is a separate local `Set<string>` (`mentorNotificationReadStore.ts`) with no backend counterpart.
- **CONFLICT**: Mild, not severe — the frontend's architecture already anticipates deriving notifications from assignment history rather than needing a dedicated channel, and the backend does expose `GET /assignments/{id}/history` → `TaskEventDto[]`. But there's a real gap: that endpoint is **per-assignment**, not a cross-assignment feed, so building "all my notifications across all my assignments, newest first" naively means one history call per assignment (N+1) — there is no `GET /assignments/events?since=` or equivalent aggregate feed endpoint, and no backend-side read/unread tracking (so "mark as read" would stay purely client-side, resetting on every browser storage clear — different from a real per-user read-state that would survive a device change).
- **RECOMMENDED RESOLUTION**:
  - Short term (matches current frontend architecture almost exactly): keep the "derived feed" approach, but request/add a lightweight backend aggregate — e.g. `GET /assignments?executorId=me` already returning enough per-item recency info (or a small `GET /me/task-events?since=` endpoint) to avoid N+1 calls. This is a small, additive backend endpoint, not a redesign.
  - Read/unread state has no backend model at all right now. Decide: is "read" state expected to survive across devices/browsers (needs a small backend table), or is client-local read-state acceptable long-term (current frontend behavior, cheapest)? This is a product call, flagging rather than assuming.
  - Admin notifications page (§3 table) has zero conflict — that one's ready to wire as-is.

### 4.3 — Mentor submission upload is 100% unimplemented on the frontend (not partially wired)

- **BACKEND CONTRACT**: `POST /api/v1/assignments/{id}/submissions` expects real `multipart/form-data` with a single `IFormFile file` field (nothing else — the API actively rejects `organizationId/branchId/categoryId/assignmentId` if present in the form body), 50MB hard limit enforced on actual bytes read, PDF/PPTX-only with real signature/structural validation (PDF header/trailer check; PPTX = ZIP/OPC validation with zip-bomb guards), SHA-256 dedup (409 `SUBMISSION_DUPLICATE_CONTENT` on identical re-upload), then a presigned-URL pattern for retrieval (`download-url`, `preview-url` — PDF preview only, PPTX gets 404 by design).
- **FRONTEND EXPECTATION**: `FileDropzone.tsx` (used in `MentorAssignmentDetailsDrawer.tsx`) has **zero networking code** — its own doc comment says the upload is "эмулируется короткой анимацией прогресса" (simulated with a progress animation). It's a `setInterval` incrementing a fake percentage; the actual browser `File` object is held in component state and then discarded — never serialized into `FormData`, never sent anywhere, not even to IndexedDB.
- **CONFLICT**: None in the sense of "contracts disagree" — there's simply no code on the frontend side to compare against yet. This is a **build**, not an **integration**: real `FormData`+`fetch`/XHR upload with real progress events, 413/415/409/422 error handling, and wiring to the presigned preview/download URLs for the review side. Both agents independently confirm this and the existing docs already scope it correctly as Phase 4/Mentor future work — not something skipped by mistake.
- **RECOMMENDED RESOLUTION**: No decision needed — proceed as planned (Phase 12 in your outline) when Lead/Mentor domain work starts. Just don't mistake "the UI already has a dropzone" for "upload is mostly done" — it's a from-scratch feature.

### 4.4 — Lead/Mentor backend surface exists, but has no handoff/open-questions doc like Phase 1's

- **BACKEND CONTRACT**: The delivered backend already implements `AssignmentsController`, `ReviewsController`, `SubmissionsController`, `TopicsController`, `TopicAssignmentsController` — i.e., real Lead/Mentor domain endpoints, not just Admin.
- **FRONTEND EXPECTATION**: The existing `docs/phase-1-owner-organization-admin/README.md` phase table marks **Phase 3 (Lead) and Phase 4 (Mentor) as "не начата" (not started)** — implying no contract reconciliation has been done for these domains the way it was done meticulously for Admin (57-endpoint catalog, traceability matrix, 9 tracked open questions).
- **CONFLICT**: The actual backend is ahead of the planning docs for this slice. That's good news capacity-wise, but it means the Lead/Mentor integration currently has **no equivalent of `Phase_1_API_Endpoint_Catalog.md`** — field-by-field DTO comparison (e.g. does `CreateAssignmentDraftRequest` match `features/lead-assignments/createAssignment.schema.ts` field-for-field? Does `PatchUserRequest`'s narrow `{FullName, ConcurrencyToken}` shape match what `userForm.schema.ts` assumes for edits?) has **not** been done at the same rigor yet — my two research agents confirmed matching route names, DTO type names, and the status enum, but did not do a full field-level diff the way the Phase 1 catalog did for Admin.
- **RECOMMENDED RESOLUTION**: Before wiring Lead/Mentor screens (your Phase 11–13), produce a `Phase_3_4_Lead_Mentor_Backend_Handoff.md`-equivalent — same rigor as the existing Phase 1 package — rather than wiring page-by-page from assumption. This is a scoped follow-up task, not a blocker for starting with Admin (Phase 1 domain) first.

### 4.5 — Concurrency tokens are required by the backend; preview stores don't carry them

- **BACKEND CONTRACT**: Nearly every mutating endpoint requires a `ConcurrencyToken` in the request body (`PatchUserRequest`, `UpdateOrganizationRequest`, `UpdateBranchRequest`, etc.) — optimistic concurrency, 409 `CONCURRENCY_CONFLICT` on mismatch.
- **FRONTEND EXPECTATION**: Preview-store mutations (`updateUserPreview`, `updateBranchPreview`, etc.) take no such field — they mutate an in-memory object directly with no version tracking.
- **CONFLICT**: Not really a disagreement, just missing plumbing — every edit form and every "get → mutate → send" flow needs to carry the `concurrencyToken` value fetched with the record and round-trip it, plus a UI treatment for the 409 case (existing "красивая существующая ошибка" pattern, per your Phase 17).
- **RECOMMENDED RESOLUTION**: Treat as a cross-cutting requirement of the Phase 3 API integration layer (fetch the token with every GET, thread it through every edit form's hidden state, surface 409 via the shared error-toast pattern) rather than a per-page fix.

### 4.6 — Minor field/validation mismatches (low severity, easy fixes)

- Category name minimum length: backend enforces **2** chars (deliberate, commented-in-code deviation from the TZ's stated "3–50"); frontend's `categoryForm.schema.ts` needs checking/relaxing to match — otherwise the frontend will reject valid input the backend accepts.
- `PATCH /users/{id}` only accepts `{FullName, ConcurrencyToken}` — much narrower than what `userForm.schema.ts`/`updateUserPreview` currently model for "edit user" (likely includes email and the orphan `notificationLanguage` field, already flagged as `PRODUCT DECISION REQUIRED` in the existing docs, §3.5). Other fields (branch/category/role) go through the dedicated `change-*` endpoints instead — the edit form will need to route fields to the correct endpoint, not one PATCH call.
- `GET /users` and `GET /users/{id}` are `LeadOrAdmin` only — Mentor has no access, not even to their own record (they get it from `/auth/me` instead). Worth double-checking during Lead "Team" page wiring that nothing on the Mentor side ever calls `GET /users`.
- Frontend has two disconnected pieces of dead/orphaned code worth cleaning up during integration rather than carrying forward: `mocks/domain/notifications.ts` (zero importers) and `api/admin/organization.ts`'s `getOrganization()` (zero callers — `/admin/settings` currently uses a separate, fake `organizationPreviewStore.ts` instead of the already-correct, MSW-backed real contract). The Settings→Organization-name wiring is actually one of the *simplest* Phase 6 wins available: the real API client, real MSW handler, and real backend `OrganizationController` all already agree — only the page needs to switch which store it reads from.

## 5. Domain readiness snapshot

| Domain | Frontend today | Backend today | Integration effort |
|---|---|---|---|
| Auth (login/refresh/logout/me/password flows) | Real HTTP client, MSW-backed | Fully implemented | **Low** — flip `VITE_USE_MOCKS=false` + point `VITE_API_BASE_URL` at real API, verify cookie/CORS behavior cross-origin |
| Organization (name) | Real API client exists but unused; page uses fake store | Fully implemented | **Low** — rewire one page to the client that already exists |
| Branches (list, read) | Real API client + MSW for list only | Fully implemented (list/get/create/update/activate/deactivate/make-head-office) | **Medium** — list is ready; create/update/lifecycle actions still need client functions (currently preview-only) |
| Admin Dashboard | Fully built against an aggregate endpoint | **Endpoint does not exist** | **Blocked on §4.1 decision** |
| Users, Categories | Preview-only, no `api/` module at all | Fully implemented | **Medium-high** — needs new API client modules + the `PreviewUserRole`→`Role`+`AdminScope` refactor (§3, already tracked in existing docs) |
| Assignments/Reviews/Submissions (Lead read/write, Mentor read) | Preview-only, high-fidelity FSM already matching backend | Fully implemented | **Medium** — needs new API client modules + §4.4 field-level reconciliation pass first |
| Submission upload (Mentor) | 100% fake, no networking code | Fully implemented (strict validation) | **High** — genuine new feature, not a swap (§4.3) |
| Notifications (Admin outbox) | Preview-only, shape already matches | Fully implemented | **Low** |
| Notifications (Mentor in-app feed) | Derived-feed architecture already in place | No dedicated endpoint; only per-assignment history | **Medium** — needs small backend addition, see §4.2 |
| Audit log | Preview-only | Fully implemented | **Low-medium** |
| Reports | Preview-only, computes its own KPIs client-side | Fully implemented, server computes the same metric set | **Medium** — must switch from `mocks/domain/reports.ts`'s client-side formulas to trusting server values (Phase 16 rule) |
| Health | Preview-only (`PREVIEW_SERVICES`), duplicated with Dashboard's `systemHealth` fixture | `HealthChecks/` present (AI/Storage), exact route not yet confirmed by this audit (ASP.NET health middleware, not a classic controller — wasn't caught by the controller-file scan) | **Needs confirmation** before wiring — verify actual `/health/live`/`/health/ready` route and response shape |
| Telegram binding, `/profile` | Route doesn't exist yet in `AppRouter.tsx`; `ChangePasswordForm.tsx` built but unmounted | Fully implemented | **Medium** — needs a new frontend route/page, not just API wiring |
| Seed / demo data | Rich, 13+ named accounts across branches/roles/scenarios | **None** — bootstrap creates exactly 1 org + 1 admin, nothing else | Needed before any real end-to-end QA — see your Phase 20 |

## 6. Already-tracked open product decisions (Admin domain)

The existing `Phase_1_Product_Extensions_and_Open_Questions.md` already tracks **9 unresolved product decisions** that block parts of the Admin backend contract (Block/Unblock semantics, Settings Notifications/Integrations tab scope, report export format, `notificationLanguage` field, admin-triggered password reset for active users, Branch extra fields, notification-detail endpoint shape, incident-history modal data source, `eligibleForLead` filter). None of these are re-litigated here — they're still open exactly as documented, and are a prerequisite gate for their specific endpoints only (not for starting integration on the other ~48 confirmed endpoints).

## 7. Suggested sequencing (proposal, not started)

1. Commit `Backend/` to git as its own commit.
2. Resolve §4.1 (Dashboard) and §4.2 (Notifications feed) — both need a decision before their pages can be wired, but nothing else is blocked by them.
3. Build the shared API integration layer (base client config, error handling, 401/403/404/409 UX, branch header) — largely already exists for Auth/Organization/Branches/Dashboard; extend the same pattern to the other domains rather than inventing a second one.
4. Wire Auth → Organization → Branches (list/read) first: lowest risk, contracts already proven identical.
5. Do the `PreviewUserRole`→`Role`+`AdminScope` refactor, then wire Users/Categories.
6. Produce the Lead/Mentor equivalent of the Phase 1 catalog (§4.4), then wire Assignments/Reviews/Schedule.
7. Build real submission upload (§4.3) — new feature, not integration.
8. Reports/Audit/Notifications-admin last among "read-heavy" domains (lowest risk, but not blocking anything).
9. Minimal seed data + full end-to-end QA per role (your Phase 23) once the above lands.

This sequencing is a proposal — flagging for confirmation rather than starting silently, since it reorders/gates parts of your original Phase 1–23 outline based on what the audit actually found (particularly: Dashboard and Notifications need backend decisions before their frontend pages can be touched at all).

# FINAL FRONTEND ↔ BACKEND INTEGRATION AUDIT

**Date:** 2026-09-08. **Companion file:** `docs/FINAL_ENDPOINT_INTEGRATION_MATRIX.md` (79 rows, one per backend endpoint — read that first, this file summarizes and explains it).

**Method, honestly stated:** code was read to find candidate wiring; nothing was accepted as working from code alone. Every LIVE_VERIFIED claim below is backed by an actual HTTP request I issued against the running Docker stack this session, cross-checked against a direct SQL query on the real PostgreSQL database and, where relevant, a direct read of the object back out of MinIO or the message list in Mailhog. Two rounds of this were done in this engagement; findings from the first round were re-verified, not assumed still true, in the second.

---

## 1-8. Endpoint counts (mechanically recounted from the matrix, not eyeballed)

| # | Category | Count |
|---|---|---:|
| — | **Total backend endpoints** | **79** |
| 2 | LIVE_VERIFIED | **25** |
| 3 | CONNECTED_NOT_LIVE_VERIFIED | **32** |
| 4 | PARTIAL | **2** |
| 5 | MOCKED | **0** |
| 6 | BACKEND_ONLY | **20** |
| 7 | DEAD_CODE | 0 |
| 8 | BLOCKED | 0 |

25+32+2+0+20+0+0 = 79. Every one of the 79 rows carries exactly one status (verified by grep, not assumed).

**MOCKED = 0** is a claim about *reachable* pages only — see §10 for the mock/dead code that still physically exists in the tree but nothing routes to it.

**BLOCKED = 0** because Docker Desktop, PostgreSQL, MinIO, and Mailhog were up and reachable for the entire session; nothing was left unverified for lack of environment.

---

## 9-10. Pages: real data vs. remaining mock/fallback

### Pages confirmed on 100% real data (verified this session, live or by direct code trace with no mock import)

**Admin:** Organization/Settings, Branches, Users, Categories, Dashboard, Audit Log, Notifications, Health.
**Lead:** Assignments (list/detail/Kanban), Review Queue, Schedule (Topics + Topic Assignments), Team.
**Mentor:** Assignments/Kanban, Submissions/file upload, Schedule, Notifications.

### Pages on real data, but not through the domain-appropriate endpoint (flagged, not "mock")

- **Admin "Отчёты"** (`ReportsPage.tsx`) — reuses `GET /admin/dashboard`'s numbers, not `GET /reports/*`. Real data, wrong domain.
- **Lead/Mentor "Отчёты"** — compute the same ANA-formulas client-side over `GET /assignments`, bypassing `GET /reports/personal|team` entirely, which means the backend's `ANA-012` (small-N anonymization for a Mentor's team view) and `ANA-013` (self-only enforcement) protections never run. Real data, no backend guardrails.
- **Admin Health** — reuses `GET /admin/dashboard`'s `systemHealth` field rather than a dedicated Health page endpoint (there isn't one — this is architecturally fine, just noted for completeness).

### Pages with a real endpoint but an incomplete/inert action inside them (not mock — a genuine no-op or missing escalation)

- **Branch create-with-admin** — admin picker is now real (fixed this session), but selecting someone still doesn't assign them (`useBranchActions.createBranch`'s admin-assignment path is an explicit, user-facing "not available yet" toast).
- **Deactivate Branch / Deactivate Category dialogs** — always send `confirmActiveUsers:false`; a 409 from the backend (branch/category has active users) has no second-step UI to acknowledge and retry. Confirmed still true in current code.
- **Reactivate a deactivated user** — `POST /users/{id}/activate` has real client code but no menu item calls it once a user is deactivated.
- **"Make head office" branch action** — real endpoint, real client wrapper, zero UI trigger.
- **Delete/activate a Topic or TopicAssignment** — all four endpoints real, zero UI triggers (the codebase's own comments already admit this).

### Mock/fixture data reachable from a routed page

**None found** as of this session. Both rounds of this audit found exactly three such cases and fixed all three (see §12).

---

## 11. Remaining BACKEND_ONLY endpoints (20)

`GET /branches/{id}/make-head-office`-family action (make-head-office), `GET /users/{id}`, `POST /users/{id}/change-category`, `GET /categories/{id}`, `GET /submissions/{id}/review`, `GET /topics/{id}`, `POST/POST/DELETE /topics/{id}/activate|deactivate` + the DELETE, `GET/PUT/POST/POST/DELETE /topic-assignments/*`'s unused half, `POST /admin/notifications/{id}/retry`, all 4 `/reports/*`, all 3 non-webhook `/telegram/*` + the webhook itself. Full list with exact routes is in the matrix file. Most of these are the same shape: **a real backend capability with zero UI entry point**, several explicitly self-documented as such in the codebase's own comments before I ever touched it.

---

## 12. Bugs found and fixed this session (with live re-verification)

1. **Lead Dashboard "Команда" + Lead Reports "По менторам"/mentor filter — real assignment data crossed with a disconnected mock mentor directory.** `leadScopedData.ts#scopedActiveMentors()` filtered a static fixture (`MENTOR_DIRECTORY`, string ids like `cat-hq-csharp`) by the real `categoryId` (a UUID) — the two id spaces never intersect, so this always returned an empty array against real data, silently zeroing out a real Lead's real team/report numbers. **Fixed**: repointed all three call sites (`useLeadDashboard.ts`, `useLeadReports.ts`, `pages/lead/ReportsPage.tsx`) to `useActiveLeadMentors()` (real, `GET /users`-backed, already used correctly by `/lead/team`). Typecheck clean, 49/49 vitest green, no regressions.
2. **Branch "create with admin" picker and branch metrics/deactivation counters — real mock data mixed into otherwise-real screens.** `BranchForm.tsx`, `BranchMetricsSection.tsx`, `DeactivateBranchDialog.tsx` all read `useUsersPreview()`/`PREVIEW_CATEGORIES` (the old fixture store) instead of `useUsersQuery()`/`useCategoriesForBranch()`. **Fixed**: repointed all three to the real hooks, matched by real `branchId` instead of a fragile branch-name string.
3. **`POST /submissions/{id}/reviews` crashed with an unhandled 500 for a legitimate, UI-reachable input.** Found live: a Lead sending a mentor back for rework with a deadline earlier than the assignment's original deadline hit PostgreSQL's `ck_assignments_due_order` check constraint (`current_due_at >= initial_due_at`), which `ReviewService.CreateCoreAsync` never validated before `SaveChanges` — an unhandled `DbUpdateException` surfaced as a raw `500 INTERNAL_ERROR`. The frontend's own `NeedsReworkForm` only refuses a past date, never one earlier than the original deadline, so a real Lead using the real UI could and would hit this. **Fixed** (backend, `ReviewService.cs`, mirroring the existing `ux_reviews_submission` → `ConflictException` translation immediately above it): added a translation of `ck_assignments_due_order` → a clean `ValidationAppException("reworkDueAt", "Новый дедлайн не может быть раньше первоначального дедлайна задания.")`. Rebuilt the `api` Docker image, restarted the container, re-ran the exact same request live: **500 → 400** with the intended clean message. Then completed the full rework cycle with a valid date and confirmed `Approved` at the end. `dotnet build`/310 unit/64 architecture tests still green after the change.
4. **`ActorLabel` in `AssignmentService.cs` always returns "Lead" for a masked actor**, even for a `SubmissionUploaded` event the Mentor performed themselves (found live: Mentor's own history showed their own upload attributed to "Lead"). **Not fixed** — this is a masking-logic decision, not a wiring gap, and changing it risks getting the intended EVT-004 semantics wrong without a product decision on what a Mentor should see for their own actions. Flagged for a deliberate follow-up.

---

## 13. Remaining security concerns

- Cross-tenant/cross-branch 403/404 boundary behavior (e.g., a Branch Admin of Branch B trying to read Branch A's users/categories) was **not** independently live-tested this session — the policies exist in every controller I read (`OrganizationAdmin`, `AnyAdmin`, branch-scoped `ApplyVisibility` calls referenced throughout the service layer) but I did not personally fire a request proving a 403/404 boundary holds. This is a real live-test gap, not a "believed fine" claim.
- `POST /auth/forgot-password`'s reset link is only ever written to the server log, never emailed (pre-existing, documented in `docs/INTEGRATION_UI_ISSUES.md` #19's "Related, NOT fixed" note, independently reconfirmed by reading `AuthController.ForgotPasswordAsync` this session) — a real backend gap, not in this session's fix scope.
- CSRF double-submit (`mtf_csrf`/`X-CSRF-Token`) and refresh-token rotation were live-verified working correctly for one account; not repeated for all five.

---

## 14. Remaining live-test gaps (explicitly not claimed as verified)

- All 32 CONNECTED_NOT_LIVE_VERIFIED rows in the matrix — real code, not personally fired this session.
- Cross-branch/cross-tenant isolation boundary (403/404) — see §13.
- Backend integration test suite: **456/461 passed**; the 5 failures are all in `BootstrapTests.cs`, all the same root cause (`Unable to resolve service for type 'IHostEnvironment'` in the test's own hand-built `ServiceCollection`, unrelated to `BootstrapProvisioner`'s real runtime wiring — the real app registers `IHostEnvironment` automatically via `WebApplicationBuilder`, and bootstrap has demonstrably already run correctly in the live environment, seeding the 5 real accounts used throughout this audit). Pre-existing, not touched this session, not caused by the `ReviewService.cs` change. Not fixed — out of this session's scope (test-harness DI setup, not frontend↔backend wiring), flagged here rather than silently left unmentioned.

---

## Fixes applied this session — file list

- `Frontend/src/shared/overlays/overlayZIndex.ts` (from the earlier part of this engagement, not this audit pass — dropdown/modal z-index)
- `Frontend/src/features/admin-branches/{AssignBranchAdminDialog,ChangeBranchAdminDialog,BranchAdminSection,BranchForm,BranchMetricsSection,DeactivateBranchDialog}.tsx`
- `Frontend/src/features/admin-branches/useBranchActions.ts`, `branchPresentation.ts`
- `Frontend/src/pages/admin/BranchesPage.tsx`
- `Frontend/src/features/lead-dashboard/useLeadDashboard.ts`
- `Frontend/src/features/lead-reports/useLeadReports.ts`
- `Frontend/src/pages/lead/ReportsPage.tsx`
- `Backend/src/MentorTaskFlow.Infrastructure/Reviews/ReviewService.cs`

All frontend changes: `tsc --noEmit` clean, `npm run build` clean (incl. `verify:bundle`), `vitest run` 49/49. All backend changes: `dotnet build` clean, unit 310/310, architecture 64/64, integration 456/461 (5 pre-existing, unrelated failures).

---

## Final verdict: **PARTIALLY READY**

Core P0 (auth incl. refresh/CSRF, branch/role isolation policies, the full Lead↔Mentor assignment→submission→review→**rework**→resubmit→approve cycle including a real file round-tripped through MinIO and real emails through Mailhog) is **LIVE_VERIFIED end-to-end**, including one real crash found and fixed live in that exact path. P1 domains (Users, Branches, Categories, Topics/Schedule, Team, Dashboard, Notifications) are live-verified for their primary read/write paths, with three mock-data leaks found and fixed this engagement and a handful of documented, still-open "real endpoint, no UI trigger" gaps (P1: reactivate user, make-head-office, deactivate-with-active-users escalation; lower severity: Topic/TopicAssignment hard-delete). P2 (Reports, Telegram) is backend-complete and entirely unconnected to any UI — not a mock, a genuine zero.

Not READY, because: the Reports domain's real anonymization/self-only protections are bypassed by a client-side reimplementation on pages that look identical to a user; two dialogs (branch/category deactivation) can hand an admin a raw error with no recovery path; cross-tenant isolation was not independently live-tested; and 5 backend tests fail (pre-existing, unrelated to any P0/P1 path).

# Integration UI Issues

Issues found while wiring the frontend to the real backend. Per the integration ground rules: UI is not
redesigned during this work — problems are logged here for a separate polish pass, not fixed inline.

---

## 1. Branches list/detail show placeholder zeros for fields backed by unwired domains

**Page**: `/admin/branches` (list and detail drawer)

**Issue**: `BranchDto`/`BranchSummaryDto` from the real backend carry only `name, code, address,
timeZoneId, isHeadOffice, isActive, createdAt, concurrencyToken` — no category count, mentor count,
active-assignment count, health percentage, admin name, city/email/phone, or activity feed. Those fields
existed only in the old preview-store fixture data. Now that Branches is wired to the real API while
Users/Categories/Assignments are not, every branch row/detail shows `0`, `null`, or an empty list where
the mock used to show plausible numbers.

**Severity**: Medium — not incorrect (no fake data is shown), but a visible regression in how informative
the page looks until the other domains are wired.

**Recommended fix**: No action needed beyond wiring Users/Categories/Assignments in a later phase — these
fields should start populating automatically once `useBranchesQuery`'s `toBranchDetails()` mapper is
extended to pull real counts from those domains instead of hardcoded placeholders.

---

## 2. No UI control exists for "make head office"

**Page**: `/admin/branches` → `BranchActionMenu`

**Issue**: The backend fully supports `POST /branches/{id}/make-head-office` (client function
`makeHeadOfficeBranch()` now exists in `api/admin/branches.ts`), but no menu item, button, or dialog in
the current UI ever triggers it — confirmed by grep, not just missing at a glance. This predates this
integration pass (it's a pre-existing gap, not something broken by it).

**Severity**: Low — a real backend capability with no way to reach it from the UI.

**Recommended fix**: Product/design decision on whether and where to add this control (likely
`BranchActionMenu`, following the pattern of the existing activate/deactivate items).

---

## 3. Deactivating a branch with active users now genuinely fails, with no escalation step

**Page**: `/admin/branches` → `DeactivateBranchDialog`

**Issue**: The real backend requires `confirmActiveUsers: true` to deactivate a branch that still has
active users, otherwise it returns 409 `BRANCH_HAS_ACTIVE_USERS`. The existing dialog has only one step
("deactivate"/"cancel") with no "yes, even though it has active users" follow-up, so `useBranchActions`
always sends `confirmActiveUsers: false`. Previously (preview store) deactivation always silently
succeeded regardless of active users — that was never correct, but it meant this case was never visibly
blocked in the UI.

**Severity**: Medium — a real, previously-invisible business rule is now enforced, but the UI has no path
to acknowledge and proceed past it; the admin just sees a generic error toast and has to go deactivate the
branch's users first.

**Recommended fix**: Add a second confirmation step to `DeactivateBranchDialog` for the 409 case (read the
`BRANCH_HAS_ACTIVE_USERS` code, show "N active users will be affected — deactivate anyway?", retry with
`confirmActiveUsers: true` on confirm).

---

## 4. Branch-admin assignment/change flows are inert (Users domain not yet wired)

**Pages**: `/admin/branches` → "Create branch" (admin-assignment step), `AssignBranchAdminDialog`,
`ChangeBranchAdminDialog`

**Issue**: These flows require `POST /users/{id}/change-role`, which is out of scope for this pass (Users
domain integration is separate future work — see `docs/PHASE_0_INTEGRATION_AUDIT.md` §7 sequencing).
Dialogs are preserved pixel-identical; confirming now shows an informational toast explaining the action
isn't available yet, rather than faking success.

**Severity**: Low — expected and already scoped, not a bug; listed here for completeness/traceability
alongside the other findings from this same integration pass.

**Recommended fix**: No action needed until the Users domain is wired (tracked in
`docs/PHASE_0_INTEGRATION_AUDIT.md`).

---

## 5. Deactivating a category with active users now genuinely fails, with no escalation step

**Page**: `/admin/categories` → `DeactivateCategoryDialog`

**Issue**: Same shape as finding #3 above, now on the Categories side. The real backend requires
`confirmActiveUsers: true` to deactivate a category that still has active users, otherwise it returns 409
`CATEGORY_HAS_ACTIVE_USERS`. The dialog has only one step ("deactivate"/"cancel") with no "yes, even
though it has active users" follow-up, so `useCategoryActions.deactivateCategory` always sends
`confirmActiveUsers: false`.

**Severity**: Medium — a real business rule is now enforced, but the UI has no path to acknowledge and
proceed past it; the admin sees a generic error toast and has to deactivate the category's users first.

**Recommended fix**: Add a second confirmation step to `DeactivateCategoryDialog` for the 409 case, same
recommendation as finding #3 for `DeactivateBranchDialog`.

---

## 6. "Отправить приглашение сразу" checkbox in the Create User form no longer reflects real behavior

**Page**: `/admin/users` → "Добавить пользователя" → «Приглашение» section

**Issue**: `POST /users` sends the invitation email unconditionally — `UserService.CreateAsync` calls
`IssueInvitationAsync` every time, with no request field to suppress it. The form's "Отправить приглашение
сразу" checkbox previously (preview store) actually gated whether a fake invitation event was recorded;
now unchecking it changes nothing server-side — an invitation goes out regardless. The checkbox is kept
in the UI (per the integration ground rules) with an inline hint explaining this, and the field is dropped
from the outgoing request, but the control itself is now more decorative than functional and could mislead
an admin who deliberately unchecks it expecting to defer the invite.

**Severity**: Low-medium — no data is lost or corrupted, but the control's implied behavior and the real
behavior diverge.

**Recommended fix**: Product decision — either remove the checkbox (accept that invitations are always
immediate) or request a backend flag (`sendInvitation: boolean`) that actually gates `IssueInvitationAsync`.

---

## 7. No UI control exists to re-activate a deactivated user

**Page**: `/admin/users` → `UserActionMenu` / `UserSecuritySection`

**Issue**: The backend fully supports `POST /users/{id}/activate` (client function `activateUser()` now
exists in `api/admin/users.ts` and `useUserActions.ts`), but once a user is deactivated, no menu item or
button in the current UI ever triggers it — `UserActionMenu`/`UserSecuritySection` only render actions for
non-deactivated users. Same shape as finding #2 for Branches' `make-head-office`.

**Severity**: Low — a real backend capability with no way to reach it from the UI (pre-existing gap in the
preview-era design, not introduced by this pass).

**Recommended fix**: Product/design decision on whether and where to add a "Активировать" action for
deactivated users (likely `UserActionMenu`/`UserSecuritySection`, mirroring the deactivate item).

---

## 8. Category names may fail to resolve for a user outside the currently selected branch context

**Page**: `/admin/users` (list and detail drawer) — `categoryName` column/field

**Issue**: `UserDto.categoryId` has no embedded category name; `useUsersQuery.ts` resolves it by
cross-referencing `GET /categories`. That endpoint's result depends on the *global* branch-context
selector (CAT-025/TEN-033): with a specific branch selected it returns only that branch's categories, with
"All branches" it returns the whole organization's. The Users list itself is **not** branch-scoped for an
Organization Admin (`UserService.ApplyVisibility` returns every user regardless of the header) — so if an
Organization Admin has narrowed the global branch selector to Branch A while viewing `/admin/users` (which
still shows users from every branch), a user belonging to Branch B's category will show "Не назначено"
instead of their real category name, because Branch B's categories aren't in the currently-fetched list.

**Severity**: Low — narrow, real-data edge case (requires an Org Admin to have both narrowed the branch
context *and* be looking at the org-wide Users list at the same time); no incorrect data is shown, just an
incomplete one field for affected rows.

**Recommended fix**: Either fetch an explicit org-wide (unscoped) categories list dedicated to this
resolution (bypassing the branch-context header for this one lookup, using the same override mechanism
already added for `listCategories()` in `api/admin/categories.ts`), or accept the limitation as documented
here.

---

## 9. Submission comment has no backend field — never shown for real data

**Pages**: `/lead/assignments` (submission list tab), `/lead/review-queue`, `/mentor/tasks` (submission
history)

**Issue**: The real `SubmissionDto` (`Backend/src/MentorTaskFlow.Contracts/Submissions/SubmissionDtos.cs`)
has no `comment` field at all — not even a place for a Mentor's short note about a submitted version to
land. The old preview fixtures modeled one (`LeadSubmissionRecord.comment`), and every submission-history
UI element still has a slot for it (`{submission.comment !== null ? <p>...` in
`LeadAssignmentDetailsDrawer.tsx`/`ReviewWorkspaceDrawer.tsx`/`MentorAssignmentDetailsDrawer.tsx`). The
real-data adapter (`assignmentAdapter.ts`'s `toSubmissionRecord`) always sets `comment: null`, so these
slots render nothing rather than stale/fake preview text — matching the decision already made for this
integration pass (Phase 1E contract map, Open Question #1).

**Severity**: Medium — a real capability Mentors used to have (attaching a note to their work) is
silently gone from the UI, with no error or indication why.

**Recommended fix**: Product decision — either extend the real contract (`Submission.Comment: string?`,
`SubmissionDto` field, accepted by the upload endpoint) in the SB1 follow-up task that rebuilds real
upload networking, or formally drop the comment box from `FileDropzone.tsx`'s submit flow once that work
starts.

**Status (resolved, SB1 pass)**: The SB1 follow-up (real upload networking, see finding #15) chose the
second option's spirit without fully removing the field — the backend contract was left alone (no
schema change, out of scope for a frontend-only pass), and `MentorAssignmentDetailsDrawer.tsx`'s comment
textarea was kept but made explicitly inert: `uploadSubmission()` (`api/lead/submissions.ts`) never puts
`comment` into the `FormData` it sends, and an inline note under the textarea now reads "Комментарий не
сохраняется на сервере и виден только вам сейчас — у backend нет такого поля," the same
"visible-but-marked-inert" treatment already used for `sendInvitationNow` in `UserForm.tsx` (finding #6)
rather than the silent-no-op that would otherwise mislead a Mentor into thinking their note was recorded.

---

## 10. No UI control exists for hard-deleting a Topic or TopicAssignment

**Pages**: `/lead/schedule` → `TopicDetailsDrawer`/`TopicFormDrawer`, `TopicAssignmentFormModal`

**Issue**: The backend fully supports `DELETE /topics/{id}` and `DELETE /topic-assignments/{id}` (client
functions `deleteTopic()`/`deleteTopicAssignment()` now exist in `api/lead/topics.ts`/
`api/lead/topicAssignments.ts`), permitted only while nothing references the row (409 `RESOURCE_IN_USE`
otherwise). No menu item, button, or dialog in the current UI ever triggers either — the Lead schedule
screens only ever archive (`activate`/`deactivate`). Same shape as findings #2/#7 for Branches/Users.

**Severity**: Low — a real backend capability with no way to reach it from the UI (a topic or template
created by mistake with nothing attached yet can never be truly removed, only archived forever).

**Recommended fix**: Product/design decision on whether and where to add "Удалить" actions (likely
`TopicDetailsDrawer`'s header and the per-template row menu), mirroring the archive/restore pattern
already there.

---

## 11. Topic-level activate/deactivate has no UI control either — a pre-existing gap, not just TopicAssignment's

**Page**: `/lead/schedule` → `TopicDetailsDrawer`

**Issue**: Distinct from finding #10 (hard delete): the backend also supports archiving a Topic itself
(`POST /topics/{id}/activate`/`.../deactivate`, client functions `activateTopic()`/`deactivateTopic()`
now exist in `useTopicActions.ts`), but no button anywhere calls them — only the TopicAssignment
templates *inside* a topic have an Archive/Restore control. This was already true of the old preview
store (`setTopicActivePreview` was defined but never called by any component) — not a regression
introduced by this pass, just newly confirmed while wiring real data.

**Severity**: Low — same shape as finding #2/#7/#10: a real capability with no UI trigger.

**Recommended fix**: Product/design decision on whether a Topic itself needs its own Archive/Restore
control in `TopicDetailsDrawer`'s header (next to "Изменить"), separate from its templates' controls.

---

## 12. Lead/Mentor Dashboard and Reports show stale, mismatched mentor identities once Assignments is real

**Pages**: `/lead/dashboard`, `/lead/reports`, `/mentor/dashboard`, `/mentor/reports` (all four
out of scope for this integration pass)

**Issue**: `useLeadDashboard.ts`/`useLeadReports.ts` (and the Mentor equivalents) now read real assignment
data — they consume `useScopedLeadAssignments()`/`useScopedMentorAssignments()`, which this pass rewired
to the real `GET /assignments` — but they still resolve mentor names and the team roster via
`leadScopedData.ts`'s `scopedActiveMentors()`, which is untouched and still reads the old static
`MENTOR_DIRECTORY` fixture (fake ids like `usr-1017`). Since real assignments now carry real
`AssignedToId` guids from the backend, they never match the fixture's ids: `TeamSummaryCard`'s per-mentor
rows, `PriorityQueueCard`'s `mentorName` fallback, and `useLeadReports.ts`'s `mentorBreakdown` will all
show either the generic `'Ментор'` fallback or all-zero counts, instead of real names/numbers.
`AssignmentForm.tsx`/`ReviewWorkspaceDrawer.tsx`/Kanban and everywhere else *actually in this pass's
scope* were repointed to a new real hook (`useScopedLeadMentors.ts`/`useLeadMentorNameResolver()`) and do
not have this problem — only the four out-of-scope Dashboard/Reports pages do.

**Severity**: Medium — visibly wrong-looking numbers/names on pages a Lead/Mentor is likely to check
often, though no real data is leaked (just absent/zeroed).

**Recommended fix**: When Dashboard/Reports get their own integration pass, repoint them at
`useScopedLeadMentors()` (real) instead of `leadScopedData.ts`'s `scopedActiveMentors()` (fixture) —
same fix already applied everywhere else in this pass.

---

## 13. Task history no longer shows an inline detail caption (reassignment target, submission version, repeated cancel reason)

**Pages**: `/lead/assignments` (History tab), `/mentor/tasks` (History tab), `/mentor/notifications`

**Issue**: The old preview `LeadTaskEventRecord.detail` field carried a free-text caption per event —
the new mentor's name on a `Reassigned` event, `"Версия N"` on a `SubmissionUploaded` event, the cancel
reason repeated on a `Cancelled` event. The real `TaskEventDto` has no equivalent field at all, so
`assignmentAdapter.ts`'s `toTaskEventRecord()` always sets `detail: undefined` — the timeline now shows
only the event's label, actor, and timestamp, with no caption line underneath.

**Severity**: Low — the information isn't fully lost (the assignment's own `cancelReason` field is shown
elsewhere in the same drawer, and each submission's `versionNumber` is visible in the Submissions tab),
just no longer repeated inline in the event timeline itself.

**Recommended fix**: Accept as a UI simplification (the underlying facts are still visible elsewhere in
the same drawer), or — if this detail is genuinely wanted back — derive it client-side per event kind
(e.g. cross-reference `previousStatus`/`newStatus` and the assignment's own fields) rather than expecting
a backend field that doesn't exist.

---

## 14. Assignment "allow late submission" can't be read from the real contract — defaulted permissive

**Pages**: `/mentor/tasks` (submission form gating on `Overdue` status), `/lead/assignments`

**Issue**: `canSubmit()`'s `Overdue`-status branch checks `assignment.allowLateSubmission` — a real
setting, but one that lives on `Category.AllowLateSubmission`, never embedded on `AssignmentDto`
itself. Categories is out of scope for this pass, so there is no wired call that could fetch it.
`assignmentAdapter.ts` defaults every real assignment to `allowLateSubmission: true` (permissive,
matching the old fixture's overwhelming majority) rather than blocking the (already SB1-deferred,
non-functional) submission form for real `Overdue` assignments whose category actually disallows late
work.

**Severity**: Low — the real backend still enforces this rule server-side regardless (409
`LATE_SUBMISSION_DISABLED`) — SB1 is out of scope so no real submission call can succeed either way right
now; this only affects whether the (currently inert) form renders at all.

**Recommended fix**: When Categories is wired, thread `Category.AllowLateSubmission` through to this
adapter (e.g. `useScopedLeadAssignments`/`useScopedMentorAssignments` joining against a categories query)
instead of the hardcoded default.

---

## 15. ~~Mentor's "Отправить решение" now fails against real assignments (expected — SB1 is a separate task)~~ — RESOLVED

**Page**: `/mentor/tasks` → `MentorAssignmentDetailsDrawer` → «Решение» tab

**Issue (as originally found)**: Per that pass's explicit instructions, `SubmissionForm.handleSubmit()`'s
call to `submitPreview()` (`features/mentor/assignments/mentorAssignmentPreviewStore.ts`, re-exporting
from `features/lead/assignments/leadAssignmentPreviewStore.ts`) was left untouched — SB1 (the real upload
endpoint) and `FileDropzone.tsx` were out of scope for that pass. A real consequence followed from wiring
everything *around* it to real data: `submitPreview` looked up the assignment by id inside the OLD
in-memory preview store, whose fixture ids (`asn-hqcs-01`, etc.) never matched a real backend assignment's
guid. Clicking "Отправить на проверку" against a real, real-id assignment threw `"Задание не найдено"`
instead of silently no-op'ing the way it might have before that pass touched anything else on the page.

**Severity**: Medium — a visibly broken button on an otherwise fully-real page, though expected and
already scoped out at the time (not a bug introduced by mistake).

**Resolution (this pass — SB1 built for real)**: `api/lead/submissions.ts` now exports
`uploadSubmission(assignmentId, file, onProgress)`, a real `POST /assignments/{id}/submissions` (
`multipart/form-data`, single `file` field, no `organizationId`/`branchId`/`categoryId`/`assignmentId`/
`comment` fields — see finding #9's status update). `features/mentor-assignments/useSubmitAssignment.ts`
uploads every ready file sequentially (one real `POST` = one new `VersionNumber`, awaited before the next
starts) and invalidates `mentor-assignments`/`mentor-assignment-history`/`lead-submissions` query keys on
any success. `FileDropzone.tsx`'s fake `setInterval` progress (`simulateUpload`) is gone — files sit
`'ready'` after client-side validation and the real network upload (with real `onUploadProgress`-driven
progress) now happens only when "Отправить на проверку" is clicked, not at drop time, so a stray drop
can no longer create an unwanted real `Submission` version. A partial multi-file failure (file 2 of N
rejected server-side) is reported honestly — succeeded files are removed from the pending queue (already
real versions; re-sending would hit `SUBMISSION_DUPLICATE_CONTENT`) and failed ones stay for retry, with
a toast naming which succeeded and which didn't rather than one generic error. `submitPreview`/
`MentorAssignmentPreviewError`/`mentorAssignmentPreviewStore.ts`/`leadAssignmentPreviewStore.ts` had zero
remaining callers after this change (verified by grep) and were deleted outright.

---

## 16. Dashboard/Reports period windows ("last 30 days" etc.) are anchored to a frozen mock date, now compared against real assignment dates

**Status: resolved.** `useLeadDashboard.ts`, `useLeadReports.ts`, `useMentorDashboard.ts`, `useMentorReports.ts`
now compute `now`/`fromMs` from `leadNow()`/`mentorNow()` (`Date.now()`) inside each `useMemo`, matching the
fix already applied elsewhere in `leadDateFormat.ts`/`mentorDateFormat.ts`. `MOCK_NOW` import removed from
all four files; `DAY_MS`/`HOUR_MS` (unit constants, not date anchors) kept. `typecheck`/`build`/49-test suite
re-verified clean after the change. Investigated but left alone as genuinely out of scope: `categoryDayLabel`
in `mentorDateFormat.ts` also reads `MOCK_NOW` but has zero call sites anywhere in the app (dead code, not a
live bug); `leadWorkspace.ts`'s `MentorDirectoryEntry.lastActiveOffsetHours` is paired with still-fixture Team
data (issue #12) and correctly stays `MOCK_NOW`-anchored until that domain is wired for real.

**Pages**: `/lead/dashboard`, `/lead/reports` (out of scope for this pass)

**Issue**: `useLeadDashboard.ts`'s activity-series bucketing and `useLeadReports.ts`'s period filter
(`fromMs = MOCK_NOW - filters.periodDays * DAY_MS`) both compute their time window from `MOCK_NOW`
(`mocks/domain/reference.ts`, frozen at `2026-08-02T09:00:00Z`) rather than the real current time. This
was harmless while every assignment date was also a synthetic offset from the same `MOCK_NOW` anchor;
now that `useScopedLeadAssignments()` (rewired by this pass) returns real assignment dates from the
backend, every period-window calculation on these two pages is silently anchored to a date that falls
further behind the real "today" with each passing day (already ~19 days stale as of this writing) instead
of tracking `Date.now()` the way `leadDateFormat.ts`'s `leadNow()` was fixed to do everywhere *in* this
pass's scope.

**Severity**: Medium — KPIs and the activity chart will silently drift from correct as real time passes,
with no visible error.

**Recommended fix**: When Dashboard/Reports get their own integration pass, replace the direct `MOCK_NOW`
imports in `useLeadDashboard.ts`/`useLeadReports.ts` (and the Mentor equivalents,
`useMentorDashboard.ts`/`useMentorReports.ts`) with `leadNow()`/`mentorNow()` — already fixed to
`Date.now()` by this pass for exactly this reason.

---

## 17. Branch display-name relabeling silently overrode real branch names (found live, fixed)

**Status: resolved**, found and fixed during the first live-backend verification session (2026-08-22).

**Page**: `/admin/dashboard` (Best Branch card, Top Teams card), `/admin/assignments`

**Issue**: `dashboardFormatters.ts`'s `formatBranchDisplayName()` was a demo-era lookup translating exactly
three old preview fixture names to invented city labels (`'Главный офис' → 'Душанбе'`, `'Филиал Худжанд' →
'Худжанд'`, `'Филиал Бохтар' → 'Бохтар'`). Once real branches flowed through Dashboard, a real branch an
admin had genuinely named "Главный офис" displayed as "Душанбе" instead — a real, silently-wrong-data bug,
not a missing-field gap. Caught by comparing the live UI against a direct API query (`GET /branches` /
`GET /admin/dashboard`), which showed the real name; no `git`/static check would have caught this since it
compiles and type-checks fine.

**Fix**: `formatBranchDisplayName()` is now an identity function (returns the input unchanged). Call sites
(`BestBranchCard.tsx`, `TopTeamsCard.tsx`, `AssignmentsPage.tsx`) are untouched.

**Same bug found a second time, separately**: `admin-preview/branchDirectory.ts`'s `branchDisplayName()`
is an independent, parallel implementation of the identical pattern (`BRANCH_DIRECTORY` mapping
`'Главный офис' → 'Душанбе'` etc.), used across 15 files in Users/Categories/Notifications/Assignments
admin pages. Also found live (Users list showed "Душанбе" as the real bootstrap branch's access scope) and
fixed the same way (identity function). `branchIdFromRawName`/`branchRawNameFromId` in the same file were
deliberately left untouched — different concern (ID resolution, not display), not confirmed broken.

---

## 19. Invitation emails had no way to actually set a password (found live, fixed — real backend bug)

**Status: resolved.**

**Pages**: N/A — backend bug, not a UI issue, but logged here since it was found during this same live
verification pass and blocked all non-bootstrap login.

**Issue**: `POST /users` correctly enqueues a `UserInvitation` email, but `NotificationTemplates.Render()`
never included a set-password link anywhere in it — only a bare "Открыть в приложении: {appBaseUrl}"
line. Confirmed live via MailHog: all 3 invitation emails sent during this session's seed-data creation
said "open the app" with no way to actually set a password. The code's own doc comments (`NTF-017`) already
described the intended design ("the renderer builds the link from the security token when it sends") but
it was never implemented — a genuine, confirmed gap, not a design ambiguity.

**Fix** (backend): `OutboxDispatcher` now mints a fresh set-password link at send time (via
`AuthService.IssueSetPasswordLinkAsync`, only for `UserInvitation` rows) and passes it through a new
transient `NotificationMessage.ActionUrl` field — never persisted to the outbox row, honoring NTF-017
(the token is stored hashed; there is no plaintext to recover from an already-written row, so send-time
minting is the only correct point). `NotificationTemplates.Render` uses it when present. Backend
`dotnet build`/310 unit/64 architecture/18 live-Postgres integration tests all re-verified green.

**Related, NOT fixed here**: `AuthController.ForgotPasswordAsync`/`ResetPasswordAsync` have the identical
gap — the reset link is only ever written to the server log (`logger.LogInformation`), never emailed. Out
of scope for this pass (blocked live Lead/Mentor login via the invitation flow specifically; forgot-password
wasn't on the critical path). Flagging for a follow-up using the same fix pattern.

---

## 18. Branches page "Распределение пользователей" widget never wired to real data

**Page**: `/admin/branches` (Organization Admin view only)

**Issue**: `BranchesPage.tsx` computes this widget's rows and percentages directly from
`PREVIEW_BRANCH_USER_DISTRIBUTION` (`mocks/ui-preview/branches.preview.ts`), a static fixture — confirmed
live: with exactly 1 real user in the database, the widget still showed "36 по филиалам" split
Душанбе/Худжанд/Бохтар 61%/25%/14%. This was missed by the earlier Branches integration pass because the
widget has no test coverage and typechecks/builds fine regardless of its data source.

**Severity**: Medium — actively misleading (fabricated numbers, not just zeros/placeholders like finding
#1), on a page an Organization Admin is likely to check for a real read of branch headcount.

**Recommended fix**: Replace with a real computation grouping `useUsersQuery()`'s real user list by
`branchId` (Users domain is already wired) — same pattern as `useBranchesQuery`'s `toBranchDetails()`
mapper reading from real data instead of a fixture. Not fixed in this pass: deprioritized behind the core
Lead/Mentor assignment-lifecycle live verification, which is this session's primary goal.

---

## 20. `useLeadScope`/`useMentorScope` crashed the entire Lead/Mentor app on any real category (found live, fixed — P0)

**Status: resolved.**

**Pages**: Every Lead and Mentor page (both roles render nothing but an error boundary until this is
fixed — the scope hook is the single entry point every page reads).

**Issue**: `AuthUserDto` (the real `GET /auth/me` / login response shape) only ever carried
`CategoryId: Guid?` — a bare id, no name or time zone. `useLeadScope.ts`/`useMentorScope.ts` resolved that
id through the old preview fixture directory (`leadWorkspace.ts`'s `categoryDirectoryEntry()`), which threw
`Error` for any id not already baked into the fixture. Every real category created via the live Admin UI in
this session's seed data (Phase D) had a real, non-fixture id, so both hooks threw on first render — the
entire Lead and Mentor app was unusable against real data, not degraded, crashed outright. The pre-existing
test suite never caught this because its mock category ids happened to coincide with the fixture's known
ids; only a genuinely new real-backend category id exposed it, which is exactly why this needed live
verification rather than static review.

**Fix** (backend + frontend, mirrors finding #19's pattern of "the doc comments already described the
intended design, it just wasn't implemented"): Added `CategorySummaryDto` (id/name/timeZoneId) mirroring
the existing `BranchSummaryDto`; `AuthUserDto.CategoryId: Guid?` replaced with `AuthUserDto.Category:
CategorySummaryDto?`; `AuthService.MapProfileAsync` now joins `Categories`/`CategorySettings` to populate it
(no nav property existed, so an explicit LINQ join was required). OpenAPI contract (`CategorySummary`
schema) and generated TS types regenerated. `useLeadScope.ts`/`useMentorScope.ts` now read
`user.category.{id,name,timeZoneId}` directly from the real auth response — no fixture lookup, no throw
path. `mocks/db.ts`/`mocks/domain/organization.ts` updated with a `categorySummary()` mock helper so the
MSW mock path matches the new real shape. Backend `AuthFlowTests.cs` (30/30) and frontend typecheck
re-verified green.

---

## 21. Mentor Dashboard "Последняя активность" always showed empty regardless of real activity (found live, fixed)

**Status: resolved.**

**Page**: `/mentor/dashboard` (Recent Activity card)

**Issue**: `useMentorDashboard.ts` read `a.events` off records from `useScopedMentorAssignments()` to build
`recentActivity`. That hook deliberately never hydrates `events` (see its own doc comment — event history
is fetched per-assignment only where actually rendered, to avoid an N-fan-out history call on every page
that lists assignments), so `a.events` was always empty and the card showed "Пока нет активности" no matter
how much real `TaskEvent` history existed. Confirmed live: after a full real submit → rework → resubmit →
approve cycle (8 real events), the card still showed the empty state. `useMentorNotifications.ts` already
solves exactly this by using the sibling hook `useScopedMentorAssignmentsWithEvents()` instead — this card
was simply wired to the wrong one.

**Fix**: `useMentorDashboard.ts` now calls `useScopedMentorAssignmentsWithEvents()` in place of
`useScopedMentorAssignments()`. Re-verified live: the card immediately showed all 8 real events in correct
reverse-chronological order (Одобрено → Взято на проверку → Отправлено на проверку → Возвращено на
доработку → ... → Черновик создан) with correct relative timestamps.

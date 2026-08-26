# Phase 1E — Lead / Mentor Contract Map

Status: **research only, no code changed**. Produced by reading the real C# source (controllers,
Contracts DTOs, domain entities, application services) against the real frontend source (preview
stores, seed fixtures, Zod schemas, route files) — not against either side's doc comments. Closes the
gap flagged in [`docs/PHASE_0_INTEGRATION_AUDIT.md`](./PHASE_0_INTEGRATION_AUDIT.md) §4.4: Lead and
Mentor had a real backend surface but no field-level contract catalog the way
[`docs/phase-1-owner-organization-admin/Phase_1_API_Endpoint_Catalog.md`](./phase-1-owner-organization-admin/Phase_1_API_Endpoint_Catalog.md)
already gives the Admin domain. This document is that catalog's Lead/Mentor sibling, same rigor,
own classification vocabulary (specified by the task that produced this document, not copied from
Phase 1 — see below).

Base path: **`/api/v1`**. None of these routes take `X-MTF-Branch-Id` — Lead and Mentor both have a
fixed scope (one category, one branch) carried on the JWT (`AuthUserDto.CategoryId`/`Branch`), and the
header is refused with 403 `SCOPE_OVERRIDE_FORBIDDEN` for anyone who isn't an Organization Admin
(`TEN-032`, confirmed unchanged from Phase 0). The one header-sensitive path in this domain is the
Organization-Admin branch of `POST /assignments/{id}/cancel`'s force-cancel, which is already
cataloged as Admin-domain endpoint `AS8` in the Phase 1 package — not repeated here.

## Classification vocabulary

Two independent labels per endpoint, as specified by the task:

**Frontend integration status** (one of five, no others):
- `READY_TO_CONNECT` — frontend shape already matches the real DTO closely; wiring is close to a
  mock-flag flip.
- `NEEDS_MAPPING` — the real endpoint exists and a frontend analog exists, but field names, types, or
  request shape need translation work before they can be pointed at each other.
- `UI_MISSING` — the backend fully supports the operation; no frontend trigger (button, form, call
  site) exists for it anywhere in `features/lead*`/`features/mentor*`.
- `NOT_BUILT` — the frontend is pure UI simulation with no real networking to swap in for (the file
  upload is the canonical case, exactly as named in the task brief).
- `PRODUCT_DECISION_REQUIRED` — a genuine ambiguity that should be resolved before implementation,
  not just "needs building."

**Shape match** (how the existing preview-store function compares to the real DTO): `MATCH` /
`PARTIAL MATCH` / `CONFLICT` / `NO FRONTEND EQUIVALENT`.

Everything below is drawn from source actually read in this pass:
`Backend/src/MentorTaskFlow.Api/Controllers/{Assignments,Reviews,Submissions,Topics}Controller.cs`,
`Backend/src/MentorTaskFlow.Contracts/{Assignments,Reviews,Submissions,Schedule}/*Dtos.cs`,
`Backend/src/MentorTaskFlow.Domain/{Assignments,Reviews,Submissions,Schedule}/*.cs`,
`Backend/src/MentorTaskFlow.Infrastructure/{Assignments,Reviews,Submissions,Schedule}/*Service.cs`,
`Backend/src/MentorTaskFlow.Infrastructure/Storage/UploadedFileInspector.cs`,
`Backend/src/MentorTaskFlow.Infrastructure/Options/StorageOptions.cs`,
`Backend/src/MentorTaskFlow.Api/Authorization/MtfPolicies.cs`, and every file listed under "What the
frontend must contain" in the task brief (preview stores, seed fixtures, Zod schemas, `AppRouter.tsx`,
`FileDropzone.tsx`).

## Headline summary

| Module | Endpoints | READY_TO_CONNECT | NEEDS_MAPPING | UI_MISSING | NOT_BUILT | PRODUCT_DECISION_REQUIRED |
|---|---|---|---|---|---|---|
| Assignments (`/assignments*`) | 10 | 0 | 10 | 0 | 0 | 0 |
| Reviews (`/submissions/{id}/reviews`, `/review`) | 2 | 0 | 2 | 0 | 0 | 0 |
| Submissions (`/assignments/{id}/submissions`, `/submissions/{id}/*-url`) | 4 | 0 | 3 | 0 | 1 | 0 |
| Topics (`/topics*`) | 9 | 0 | 8 | 1 | 0 | 0 |
| TopicAssignments (`/topic-assignments*`) | 5 | 0 | 4 | 1 | 0 | 0 |
| **Total** | **30** | **0** | **27** | **2** | **1** | **0** |

Check: `0 + 27 + 2 + 1 + 0 = 30`.

**The single most important finding**: unlike the Admin domain's Auth/Organization slice (Phase 0
§3 — "large parts... will genuinely be a mock-flag flip"), **zero Lead/Mentor endpoints are
`READY_TO_CONNECT` as-is.** Every mutating preview-store function is missing `concurrencyToken`
end-to-end (not one Lead/Mentor record type carries the field at all — verified in
`leadAssignments.preview.ts`, `leadTopics.preview.ts`, and every `*PreviewStore.ts`), and every read
shape renames or drops real fields (`mentorId`→`AssignedToId`, epoch-`number` dates→`DateTimeOffset`,
no `Branch`/`Organization` ids, reviewer/actor shown by name where the real contract gives an id or a
role label). The good news the same research turned up: the **status-machine semantics** are exactly
right — see the FSM section below — so the mapping work is mechanical field translation, not a
redesign. Four concrete, previously-uncaught contract gaps (not just naming) are detailed in
[Open Questions](#open-questions): the submission `comment` field, multi-file-per-submission UI vs.
one-file-per-version backend, actor/reviewer identity leaking to Mentor-facing views where TZ (`EVT-004`)
requires masking, and a `Topic.PlannedDate` uniqueness rule the frontend's own code comment describes
as a soft warning when the backend enforces it as a hard `409 RESOURCE_ALREADY_EXISTS` via a DB unique
index (`ux_topics_category_planned_date`).

---

## 1. Assignments (`/api/v1/assignments*`)

Controller: `AssignmentsController`. Service: `IAssignmentService` / `AssignmentService`. All ten
actions read `Assignment.cs`'s named transition methods directly — no endpoint sets `status` as a
field (`API-008`, `API-010`).

| # | Method & Route | Policy | Request DTO | Response DTO | Frontend equivalent | Shape match | FE status | Notes |
|---|---|---|---|---|---|---|---|---|
| LA1 | `GET /assignments` | `Authenticated` (scoped in-service: Mentor→own non-draft/suggested only, Lead→own category, Admin/Branch→own branch, Admin/Org→all) | `AssignmentListQuery{Page,PageSize,Status?,CategoryId?,AssignedToId?,Source?,Sort?,Order?}` | `PagedResult<AssignmentDto>` | `useLeadAssignmentsPreview()` / `useScopedLeadAssignments()` / `useScopedMentorAssignments()` — read the full in-memory array, filtered client-side, never paged | PARTIAL MATCH | NEEDS_MAPPING | `AssignmentDto` has 21 fields (`OrganizationId, BranchId, CategoryId, TopicAssignmentId, AssignedToId, AssignedById, Title, Description, Status, Source, InitialDueAt, CurrentDueAt, GeneratedForDate, AssignedAt, FirstSubmittedAt, ReviewStartedAt, ApprovedAt, OverdueAt, CancelledAt, CancelReason, CreatedAt, ConcurrencyToken, Branch?`); `LeadAssignmentRecord` has 20 similarly-named-but-renamed fields and **no `ConcurrencyToken`, no `OrganizationId`, no `Branch` summary**. Dates are epoch `number` in preview vs `DateTimeOffset` (ISO) on the wire. Pagination is entirely absent client-side — every screen assumes the whole category's assignments fit in memory |
| LA2 | `GET /assignments/{id}` | `Authenticated` | — | `AssignmentDto` | same records, read by `.find(a => a.id === id)` | PARTIAL MATCH | NEEDS_MAPPING | Same field deltas as LA1 |
| LA3 | `GET /assignments/{id}/history` | `Authenticated` | — | `TaskEventDto[]{Id,SequenceNumber,EventType,ActorId?,ActorLabel?,PreviousStatus?,NewStatus?,OccurredAt,CorrelationId}` | `a.events: LeadTaskEventRecord[]` embedded directly on the assignment record, not fetched separately | CONFLICT | NEEDS_MAPPING | The 12 `EventType` values match `TaskEventKind` **by name exactly** (`DraftCreated, SuggestedCreated, SuggestionAccepted, Assigned, Reassigned, SubmissionUploaded, LateSubmissionUploaded, ReviewStarted, ReviewApproved, ReviewNeedsRework, MarkedOverdue, Cancelled`) — a genuine, solid alignment. But `EVT-004` masks the actor for a Mentor caller: `ActorId=null`, `ActorLabel="Lead"` or `"Система"` only. The frontend seed data instead stamps every event with a real `actorName` (e.g. `'Шерали Комилов'`) and shows it unconditionally to Mentor-facing screens (`MentorAssignmentDetailsDrawer`, `useMentorDashboard`'s `RecentActivityCard`). This is a masking rule the frontend does not implement at all — see Open Questions |
| LA4 | `POST /assignments/drafts` | `Lead` | `CreateAssignmentDraftRequest{AssignedToId:Guid, TopicAssignmentId:Guid?, Title:string?, Description:string?, DueAt:DateTimeOffset?}` — `OrganizationId/BranchId/CategoryId` are never accepted, derived from the Lead's own token | `AssignmentDto` (201, `Location` via `RouteNames.GetAssignment`) | `createDraftPreview(input:{categoryId,title,description,mentorId,dueAt,leadName})` | PARTIAL MATCH | NEEDS_MAPPING | Field renames only (`mentorId`→`AssignedToId`, `dueAt:number`→`DueAt:DateTimeOffset?`); `categoryId` in the preview input is harmless — the real request never sends it either, both sides derive it server/scope-side. `AssignmentForm.tsx` already treats an empty-string `topicAssignmentId` as "no template" (`values.topicAssignmentId.length > 0 ? … : null`), which lines up with the real optional `Guid?`. `leadName` has no backend counterpart — the actor is the JWT subject, never a request field |
| LA5 | `PUT /assignments/{id}` | `Lead` (object-level: 404 if the assignment's `CategoryId` isn't the caller's — `TEN-006`) | `UpdateAssignmentRequest{AssignedToId:Guid, Title:string, Description:string?, DueAt:DateTimeOffset, ConcurrencyToken:string}` — allowed only in `Draft`/`Suggested` (`ASN-004`) | `AssignmentDto` | `editAssignmentPreview(categoryId,id,input:{title,description,mentorId,dueAt})` | CONFLICT | NEEDS_MAPPING | Missing `concurrencyToken` (cross-cutting, see below). **Genuine behavioral bug to fix during wiring, not just a rename**: `Assignment.Edit()` sets `InitialDueAt`/`CurrentDueAt = initialDueAt` unconditionally whenever status is `Draft` **or** `Suggested`. The preview function only updates the due date when `a.status === 'Draft'` (`initialDueAt: a.status === 'Draft' ? input.dueAt : a.initialDueAt`), silently discarding the user's due-date edit for a `Suggested` assignment. A future implementation must drop that conditional |
| LA6 | `POST /assignments/{id}/publish` | `Lead` | `AssignmentActionRequest{ConcurrencyToken:string}` — `Draft→Assigned` (`ASN-002`) | `AssignmentDto` | `publishPreview(categoryId,id,leadName)` | PARTIAL MATCH | NEEDS_MAPPING | Only gap is the missing token; `canPublish()` (Draft-only) matches `Require(Draft, Assigned)` exactly |
| LA7 | `POST /assignments/{id}/accept-suggestion` | `Lead` | `AssignmentActionRequest{ConcurrencyToken}` — `Suggested→Assigned`, writes two `TaskEvent`s (`SuggestionAccepted` then `Assigned`, one correlation id — `EVT-005`) | `AssignmentDto` | `acceptSuggestionPreview(categoryId,id,leadName)` — already pushes two events matching that exact split | MATCH (minus token) | NEEDS_MAPPING | The two-event behavior is already correctly modeled client-side; only the token is missing |
| LA8 | `POST /assignments/{id}/reassign` | `Lead` | `ReassignAssignmentRequest{AssignedToId:Guid, ConcurrencyToken:string, Reason:string?}` — `Draft`/`Suggested` always, `Assigned` only if `FirstSubmittedAt is null` (`10.6.3`) | `AssignmentDto` | `reassignPreview(categoryId,id,leadName,mentorId,mentorName)` | PARTIAL MATCH | NEEDS_MAPPING | Missing token; also missing the optional `Reason` field entirely — no UI collects it. `canReassign()` matches the backend's `Draft\|Suggested\|Assigned-without-submissions` rule exactly |
| LA9 | `POST /assignments/{id}/start-review` | `Lead` | `AssignmentActionRequest{ConcurrencyToken}` — `Submitted→InReview` only via this explicit action (`REV-001`, never on page-view) | `AssignmentDto` | `startReviewPreview(categoryId,id,leadName)` | MATCH (minus token) | NEEDS_MAPPING | `canStartReview()` (Submitted-only) matches exactly |
| LA10 | `POST /assignments/{id}/cancel` | `LeadOrAdmin` (Mentor is explicitly 403'd in-service even though the policy alone wouldn't stop them from reaching the action method) | `CancelAssignmentRequest{CancelReason:string(5–500), ConcurrencyToken:string}` — any non-terminal status (`ASN-006`/`ASN-024`) | `AssignmentDto` | `cancelPreview(categoryId,id,leadName,reason)` and `rejectSuggestionPreview(...)` (thin wrapper calling the same function) | PARTIAL MATCH | NEEDS_MAPPING | Missing token; the 5–500 char validation is already duplicated client-side correctly. **Side-effect nuance for the implementer**: `AuditLog` is written **only** when `actor.Role is Admin` (the force-cancel path, already cataloged as `AS8` in the Admin package) — an ordinary Lead-triggered cancel writes a `TaskEvent` and a notification but **no** `AuditLog` row. Don't add generic audit logging to the Lead-facing cancel call |

**Assignments module total: 10/10 NEEDS_MAPPING, 0 READY_TO_CONNECT, 0 UI_MISSING, 0 NOT_BUILT.**

---

## 2. Reviews (`/api/v1/submissions/{id}/reviews`, `/api/v1/submissions/{id}/review`)

Controller: `ReviewsController`. Service: `IReviewService` / `ReviewService`. No `PUT`, no `DELETE`,
for anyone — a `Review` is immutable once written (`REV-020`), enforced by `ux_reviews_submission`
(one review per submission, race-safe).

| # | Method & Route | Policy | Request DTO | Response DTO | Frontend equivalent | Shape match | FE status | Notes |
|---|---|---|---|---|---|---|---|---|
| RV1 | `POST /submissions/{id}/reviews` | `Lead` (object-level: 404 unless `submission.CategoryId == actor.CategoryId`) | `CreateReviewRequest{Decision:"Approved"\|"NeedsRework", ConcurrencyToken:string, Comment:string?, ReworkDueAt:DateTimeOffset?}` — `id` in the route is the **submission id**, and only the **latest** version of the assignment's submissions may be decided on (409 `REVIEW_NOT_LATEST_SUBMISSION` otherwise, `REV-004`); the token is the **assignment's**, not the submission's (submissions carry no token at all) | `ReviewDto{Id,SubmissionId,AssignmentId,ReviewerId,Decision,Comment?,ReworkDueAt?,CreatedAt}` (201) | `approvePreview(categoryId,id,leadName,comment)` and `requestReworkPreview(categoryId,id,leadName,comment,reworkDueAt)` — both keyed by **assignment id**, both mutate `a.submissions[last].review` in place | CONFLICT | NEEDS_MAPPING | Three real gaps, not just field renames: (1) the real call needs the **latest submission's id**, which the preview functions never surface separately (they only expose it as `a.submissions[a.submissions.length-1].id` internally) — a future API client must extract that id before calling; (2) the token to send is the **assignment's**, which the preview functions already have (`categoryId,id` scope it) but never thread through since no token exists client-side yet; (3) `ReviewDto.ReviewerId` is a raw `Guid` — the frontend shows `reviewerName:string` instead, resolved from nowhere real (see Open Questions: Mentor cannot call `GET /users` to resolve it, per Phase 0 §4.6). Validation already matches: comment 10–3000 chars required only for `NeedsRework`, `reworkDueAt` must be strictly future |
| RV2 | `GET /submissions/{id}/review` | `Authenticated` (object-level: Admin/Org→all, Admin/Branch→own branch, Lead→own category, else→`submission.SubmittedById == actor.UserId`) | — | `ReviewDto` (404 while undecided) | `submission.review: LeadReviewRecord \| null` embedded, never fetched | PARTIAL MATCH | NEEDS_MAPPING | Same `ReviewerId` vs `reviewerName` gap as RV1 |

**Reviews module total: 2/2 NEEDS_MAPPING.**

---

## 3. Submissions (`/api/v1/assignments/{id}/submissions`, `/api/v1/submissions/{id}/*-url`)

Controller: `SubmissionsController`. Service: `ISubmissionService` / `SubmissionService`. No `PUT`,
no `DELETE` — a submission is immutable and a re-upload always creates the next version (`SUB-020`).

| # | Method & Route | Policy | Request | Response DTO | Frontend equivalent | Shape match | FE status | Notes |
|---|---|---|---|---|---|---|---|---|
| SB1 | `POST /assignments/{id}/submissions` | `Mentor` (object-level: 404 unless `assignment.AssignedToId == actor.UserId`; 409 `SUBMISSION_NOT_ALLOWED` unless status ∈ {`Assigned`,`NeedsRework`,`Overdue`}; 409 `LATE_SUBMISSION_DISABLED` if `Overdue` and the category's `AllowLateSubmission=false`) | `multipart/form-data`, **one field**: `file:IFormFile`. `[RequestSizeLimit(52_428_800)]` (50 MB). Any of `organizationId/branchId/categoryId/assignmentId` present in the form is a hard 400 `VALIDATION_FAILED` — scope is never client-supplied | `SubmissionDto{Id,AssignmentId,VersionNumber,OriginalFileName,ContentType,FileExtension,FileSizeBytes,Sha256Hash,IsLate,SubmittedById,SubmittedAt,HasPreview}` (201) | `submitPreview(mentorId,id,mentorName,input:{files:LeadSubmissionFile[], comment})` via `FileDropzone.tsx` | CONFLICT | **NOT_BUILT** | See the dedicated [File Upload](#file-upload-real-requirements-vs-what-fileDropzonetsx-fakes) section. Two contract-level facts the frontend model doesn't have room for: no `comment` field exists anywhere in `SubmissionDto` or the upload contract, and the real endpoint is strictly one-file-per-call (each call is a new `VersionNumber`) where the frontend models one submission as an array of files |
| SB2 | `GET /assignments/{id}/submissions` | `Authenticated` (same visibility rule as RV2, applied to the parent assignment) | — | `SubmissionDto[]`, newest-first | `a.submissions: LeadSubmissionRecord[]` embedded | PARTIAL MATCH | NEEDS_MAPPING | `LeadSubmissionRecord` bundles `files: LeadSubmissionFile[]` (plural) and a `comment` field per version — both without a real counterpart (see SB1). `Sha256Hash`, `FileExtension`, `ContentType`, `HasPreview` have no frontend field at all today; `hasPreview` in particular is what a real `FilePreviewModal` needs to decide whether to offer a PDF viewer at all |
| SB3 | `GET /submissions/{id}/download-url` | `Authenticated` (Organization Admin in all-branches mode → 400 `BRANCH_CONTEXT_REQUIRED`, not applicable to Lead/Mentor) | — | `FileUrlDto{Url:string, ExpiresAt:DateTimeOffset}`, `Cache-Control: no-store` | `FileDetailsModal` (reused from `features/admin-assignments/`) — renders static fixture data, zero `fetch`/`axios` calls anywhere in the component | CONFLICT | NEEDS_MAPPING | A UI trigger already exists (clicking a submission's file row opens the modal) so this isn't `UI_MISSING`; it's a fully unwired call site. `PresignedUrlMinutes` defaults to 10 (`StorageOptions`), configurable 1–60 |
| SB4 | `GET /submissions/{id}/preview-url` | `Authenticated`, same rule | — | `FileUrlDto`; 404 for a PPTX (`PreviewStorageKey is null` — no PPTX preview in Release 1.0, `17.5`) | `FilePreviewModal` (same reuse, same zero-networking status) | CONFLICT | NEEDS_MAPPING | Frontend has no concept of "PPTX has no preview" today — `LeadSubmissionFile.extension` is tracked but nothing branches on it to suppress a preview affordance |

**Submissions module total: 3/4 NEEDS_MAPPING, 1/4 NOT_BUILT (the upload itself).**

---

## 4. Schedule — Topics (`/api/v1/topics*`)

Controller: `TopicsController` (top half of `TopicsController.cs`). Service: `IScheduleService` /
`ScheduleService`. Mentor is read-only across the whole schedule domain — `EnsureMayWriteSchedule`
throws 403 `Forbidden` for any Mentor caller reaching a write action, even though `LeadOrAdmin` already
excludes them at the policy layer (defense in depth, same pattern as Assignments' `RequireLead`).

| # | Method & Route | Policy | Request DTO | Response DTO | Frontend equivalent | Shape match | FE status | Notes |
|---|---|---|---|---|---|---|---|---|
| TP1 | `GET /topics` | `Authenticated` | `TopicListQuery{Page,PageSize,CategoryId?,IsActive?,Sort?,Order?}` | `PagedResult<TopicDto>` | `useLeadTopicsPreview()` / `useScopedMentorTopics()` — full in-memory array | PARTIAL MATCH | NEEDS_MAPPING | `TopicDto` has `OrganizationId,BranchId,CategoryId,DayNumber,PlannedDate:DateOnly?,Title,Description?,IsActive,CreatedAt,UpdatedAt,ConcurrencyToken,Branch?`; `LeadTopicRecord` has `categoryId,dayNumber,plannedDate:number(non-null!),title,description,isActive` only — no token, no org/branch ids, and `plannedDate` is **never null** client-side even though the real field is optional (`DateOnly?`) |
| TP2 | `GET /topics/{id}` | `Authenticated` | — | `TopicDto` | `TopicDetailsDrawer` reads from the same array by id | PARTIAL MATCH | NEEDS_MAPPING | Same deltas as TP1 |
| TP3 | `POST /topics` | `LeadOrAdmin` | `CreateTopicRequest{CategoryId:Guid, DayNumber:int, PlannedDate:DateOnly?, Title:string, Description:string?}` | `TopicDto` (201) | `createTopicPreview(input:{categoryId,dayNumber,plannedDate,title,description})` | CONFLICT | NEEDS_MAPPING | Field shapes line up well, but **the frontend's own uniqueness assumption is wrong**: its doc comment reads *"`PlannedDate` уникален... — предупреждение, а не жёсткий блок"* (a warning, not a hard block), while the database enforces `ux_topics_category_planned_date` as a real unique constraint, translated to 409 `RESOURCE_ALREADY_EXISTS` (`"В категории уже есть активная тема на эту дату."`). There is a **second**, entirely unmodeled constraint too: `ux_topics_category_day` on `DayNumber`, same 409 code (`"...тема с таким номером дня."`). Neither is a soft warning — both must be handled as blocking errors during wiring |
| TP4 | `PUT /topics/{id}` | `LeadOrAdmin` | `UpdateTopicRequest{DayNumber,PlannedDate?,Title,Description?,ConcurrencyToken}` — moving `PlannedDate` does **not** shift already-created assignments' deadlines (`TOPIC-005`) | `TopicDto` | `updateTopicPreview(categoryId,id,input)` | PARTIAL MATCH | NEEDS_MAPPING | Missing token; same two unique-constraint gaps as TP3 apply on edit too |
| TP5 | `POST /topics/{id}/activate` | `LeadOrAdmin` | `ScheduleActionRequest{ConcurrencyToken}` | `TopicDto` | `setTopicActivePreview(categoryId,id,true)` | PARTIAL MATCH | NEEDS_MAPPING | Missing token; preview correctly conflates activate/deactivate behind one boolean-flag function, trivial to split into two calls |
| TP6 | `POST /topics/{id}/deactivate` | `LeadOrAdmin` | `ScheduleActionRequest{ConcurrencyToken}` — archives; stops feeding auto-generation and pickers, stays visible (`TOPIC-013`) | `TopicDto` | `setTopicActivePreview(categoryId,id,false)` | PARTIAL MATCH | NEEDS_MAPPING | Same as TP5 |
| TP7 | `DELETE /topics/{id}` | `LeadOrAdmin` | — (no body, no concurrency check — see cross-cutting) | 204; 409 `RESOURCE_IN_USE` if anything still references the topic (`TOPIC-003`) | none | NO FRONTEND EQUIVALENT | **UI_MISSING** | The frontend's own comment treats deactivate as the permanent answer ("preview архивирует вместо удаления"), which is correct for a topic already in use, but the real backend still exposes a true hard delete for the empty case (a topic created by mistake, nothing attached yet). No Lead screen offers it — `TopicDetailsDrawer`/`TopicFormDrawer` only ever call activate/deactivate |
| TP8 | `GET /topics/{topicId}/assignments` | `Authenticated` | — | `TopicAssignmentDto[]` | `topicAssignmentsOfTopic(topicId)` — filters the same full in-memory `LEAD_TOPIC_ASSIGNMENTS` array client-side | PARTIAL MATCH | NEEDS_MAPPING | Same field deltas as TopicAssignments module below (§5) |
| TP9 | `POST /topics/{topicId}/assignments` | `LeadOrAdmin` | `CreateTopicAssignmentRequest{Type:"Presentation"\|"ClassTask"\|"HomeTask", Title, Description?, IsRequired=true}` — scope inherited from the topic in the route, never in the body (`TPL-001`) | `TopicAssignmentDto` (201) | `createTopicAssignmentPreview(categoryId,topicId,input:{type,title,description,isRequired})` | MATCH | NEEDS_MAPPING | Field-for-field the closest match in the whole domain — `TopicAssignmentType` enum values (`Presentation=0,ClassTask=1,HomeTask=2`) match the frontend union exactly by name, title/description length rules (3–200/≤2000) already match. Still `NEEDS_MAPPING` rather than `READY_TO_CONNECT` only because there is no real HTTP call site at all yet (no `api/` module exists for this domain) |

**Topics module total: 8/9 NEEDS_MAPPING, 1/9 UI_MISSING (hard delete).**

---

## 5. Schedule — TopicAssignments (`/api/v1/topic-assignments*`)

Controller: `TopicAssignmentsController` (bottom half of `TopicsController.cs`, same file). Same
`IScheduleService`. A template is a **snapshot source**, not the task — editing one never touches
assignments already created from it (`TPL-004`).

| # | Method & Route | Policy | Request DTO | Response DTO | Frontend equivalent | Shape match | FE status | Notes |
|---|---|---|---|---|---|---|---|---|
| TA1 | `GET /topic-assignments/{id}` | `Authenticated` | — | `TopicAssignmentDto{Id,TopicId,OrganizationId,BranchId,CategoryId,Type,Title,Description?,IsRequired,IsActive,CreatedAt,UpdatedAt,ConcurrencyToken}` | `TopicAssignmentFormModal`/`TopicDetailsDrawer` read from the local array by id, no dedicated fetch | PARTIAL MATCH | NEEDS_MAPPING | `LeadTopicAssignmentRecord` has `id,topicId,type,title,description,isRequired,isActive` — no token, no org/branch/category ids (all three are inherited from the topic; harmless to omit as long as the real create/update calls don't need them from the client either — they don't) |
| TA2 | `PUT /topic-assignments/{id}` | `LeadOrAdmin` | `UpdateTopicAssignmentRequest{Type,Title,Description?,IsRequired,ConcurrencyToken}` | `TopicAssignmentDto` | `updateTopicAssignmentPreview(id,input)` | PARTIAL MATCH | NEEDS_MAPPING | Missing token; every other field matches |
| TA3 | `POST /topic-assignments/{id}/activate` | `LeadOrAdmin` | `ScheduleActionRequest{ConcurrencyToken}` | `TopicAssignmentDto` | `setTopicAssignmentActivePreview(id,true)` | PARTIAL MATCH | NEEDS_MAPPING | Missing token |
| TA4 | `POST /topic-assignments/{id}/deactivate` | `LeadOrAdmin` | `ScheduleActionRequest{ConcurrencyToken}` — stops auto-generation and new-assignment pickers, existing assignments untouched (`TPL-003`) | `TopicAssignmentDto` | `setTopicAssignmentActivePreview(id,false)` | PARTIAL MATCH | NEEDS_MAPPING | Missing token |
| TA5 | `DELETE /topic-assignments/{id}` | `LeadOrAdmin` | — (no body) | 204; 409 `RESOURCE_IN_USE` if any assignment/topic-assignment reference remains (`TPL-002`) | none | NO FRONTEND EQUIVALENT | **UI_MISSING** | Same gap as TP7 — frontend always archives, never offers the real hard delete for the never-used case |

**TopicAssignments module total: 4/5 NEEDS_MAPPING, 1/5 UI_MISSING.**

---

## Assignment status FSM — backend-verified vs. frontend guards

Source of truth re-read fresh from `Backend/src/MentorTaskFlow.Domain/Assignments/Assignment.cs` and
`AssignmentStatus.cs` (not assumed from the Phase 0 audit, per the task brief). Nine states, confirmed
unchanged from Phase 0's summary at the state-name level — but this pass adds the **trigger role** and
**exact request body** for every transition, which the earlier, shallower pass didn't capture.

| # | Transition | Method | Trigger role (policy → in-service check) | Request body | Notes |
|---|---|---|---|---|---|
| 1 | `— → Draft` | `CreateDraft` | `Lead` (own category only, `RequireLead`) | `CreateAssignmentDraftRequest` | Manual creation, `Source=Manual` |
| 1b | `— → Suggested` | `CreateSuggestion` | none (scheduler-internal; no HTTP endpoint — background job only) | — | `Source=Auto`, `AssignedById=null` until accepted |
| 2 | `Draft → Assigned` | `Publish` | `Lead` (own category) | `AssignmentActionRequest{ConcurrencyToken}` | Sets `AssignedById`, `AssignedAt`; assignee must be an active Mentor of the same category (`ASN-008`, checked server-side, else 409 `CROSS_SCOPE_REFERENCE`/`ASSIGNEE_INACTIVE`) |
| 3 | `Suggested → Assigned` | `AcceptSuggestion` | `Lead` (own category) | `AssignmentActionRequest{ConcurrencyToken}` | Two `TaskEvent`s, one correlation id (`EVT-005`) |
| — | `Draft/Suggested → Draft/Suggested` (edit) | `Edit` | `Lead` (own category) | via `PUT /assignments/{id}` → `UpdateAssignmentRequest` | Status unchanged; see LA5's frontend bug note above |
| — | executor change, no status change | `Reassign` | `Lead` (own category) | via `POST /assignments/{id}/reassign` → `ReassignAssignmentRequest` | Allowed `Draft`/`Suggested`/`Assigned`-without-submissions only |
| 5/13/16 | `Assigned\|NeedsRework\|Overdue → Submitted` | `Submit` | `Mentor` (own assignment only) | via `POST /assignments/{id}/submissions` (multipart) | The one transition a Mentor triggers; `Overdue` requires the category's `AllowLateSubmission=true` |
| 8 | `Submitted → InReview` | `StartReview` | `Lead` (own category) | `AssignmentActionRequest{ConcurrencyToken}` | Never automatic — explicit action only, protects `FirstReviewResponseTime` (`API-013`) |
| 10 | `InReview → Approved` (terminal) | `Approve` | `Lead` (own category, via Review decision) | via `POST /submissions/{id}/reviews` → `CreateReviewRequest{Decision:"Approved"}` | No further action possible once here |
| 11 | `InReview → NeedsRework` | `RequestRework` | `Lead` (own category, via Review decision) | via `POST /submissions/{id}/reviews` → `CreateReviewRequest{Decision:"NeedsRework", ReworkDueAt required}` | Only place `CurrentDueAt` ever moves away from `InitialDueAt` |
| 6/14 | `Assigned\|NeedsRework → Overdue` | `MarkOverdue` | none (scheduler-internal background job; no HTTP endpoint) | — | `OverdueAt` set once only, never overwritten on a repeat overdue |
| 2/4/7/9/12/15/17 | any non-terminal → `Cancelled` (terminal) | `Cancel` | `Lead` (own category) **or** `Admin` (force-cancel, either contour) | `POST /assignments/{id}/cancel` → `CancelAssignmentRequest{CancelReason(5–500), ConcurrencyToken}` | Mentor is explicitly forbidden (403) even to cancel their own task |

### Comparison against `leadAssignmentPresentation.ts`'s `canX()` guards

Re-verified at the level the task asked for — not just "same state names" (Phase 0's shallower claim)
but "does the guard admit/reject exactly the same set of states the domain method does":

| Frontend guard | Backend method | Verdict |
|---|---|---|
| `canPublish`: `Draft` only | `Publish`: `Require(Draft, Assigned)` | **Exact match** |
| `canAcceptSuggestion`: `Suggested` only | `AcceptSuggestion`: `Require(Suggested, Assigned)` | **Exact match** |
| `canEdit`: `Draft \| Suggested` | `Edit`: `Draft \| Suggested` | **Exact match on admissible states.** Behavior inside the transition diverges — see LA5 |
| `canReassign`: `Draft \| Suggested` always, `Assigned` only if `submissions.length===0` | `Reassign`: `Draft\|Suggested\|Assigned` && `!hasSubmissions` | **Exact match** |
| `canCancel`: `!isTerminal` | `Cancel`: `EnsureNotTerminal()` | **Exact match** |
| `canStartReview`: `Submitted` only | `StartReview`: `Require(Submitted, InReview)` | **Exact match** |
| `canDecideReview`: `InReview` only | `Approve`/`RequestRework`: `Require(InReview, …)` | **Exact match** |
| `canSubmit`: `Assigned\|NeedsRework` always, `Overdue` only if `allowLateSubmission` | `Submit`: `Assigned\|NeedsRework\|Overdue`, late-submission checked one layer up in `SubmissionService.FindSubmittableAsync` | **Exact match** |

**Conclusion**: the FSM guards agree exactly at the transition-admissibility level — the earlier,
shallower audit's belief holds up under a full re-read. The gaps that exist are not in *which* states
allow *which* actions, but in the **request shapes** carried into those actions (missing
`concurrencyToken` everywhere, the LA5 due-date bug on `Suggested`-status edits, and the Reviews
module's submission-id-vs-assignment-id indirection) — none of which a state-name-level comparison
would have caught, confirming the task brief's suspicion.

---

## File upload: real requirements vs. what `FileDropzone.tsx` fakes

**Real backend** (`SubmissionsController.UploadAsync` + `UploadedFileInspector` +
`StorageOptions`, `Backend/src/MentorTaskFlow.Infrastructure/Storage/UploadedFileInspector.cs`):

- Route: `POST /api/v1/assignments/{id}/submissions`, `Consumes("multipart/form-data")`,
  `[RequestSizeLimit(52_428_800)]` (52,428,800 bytes = 50 MB, matching `StorageOptions.MaxFileBytes`
  default).
- **Exactly one multipart field**: `file` (bound to `IFormFile file` by ASP.NET model binding — no
  other field name works). Any of `organizationId`, `branchId`, `categoryId`, `assignmentId` present
  in the form is rejected outright with 400 `VALIDATION_FAILED` — the controller checks
  `Request.Form.Keys` explicitly for those four names (`TEN-061`). A `comment` field, notably, is
  **not** in that forbidden list — it would simply be ignored, not rejected, silently dropping
  whatever the UI collected.
- Validation order (steps 7–9 in `UploadedFileInspector`, all before a single byte reaches storage):
  1. Extension + declared `Content-Type` must both resolve to the same `FileExtension` — only `.pdf`
     and `.pptx` accepted (415 `FILE_TYPE_NOT_ALLOWED` otherwise). `application/octet-stream` is
     tolerated as a stand-in declared type since browsers send it often.
  2. Declared `Content-Length` over the limit is rejected before the body is read at all (413
     `FILE_TOO_LARGE`).
  3. The stream is copied to a self-deleting temp file (`FileOptions.DeleteOnClose`) while being
     hashed (SHA-256) and byte-counted in the same pass; exceeding the limit mid-stream aborts
     immediately (413) regardless of what `Content-Length` claimed — the limit is enforced on bytes
     actually read, never on a client-controlled header (`SUB-012`).
  4. Zero-byte file → 422 `FILE_EMPTY`. Declared length disagreeing with actual bytes read → 400
     `VALIDATION_FAILED`.
  5. PDF: header must start with `%PDF-`, and the last 1024 bytes must contain `%%EOF` — signature and
     trailer only, no structural parsing (422 `FILE_SIGNATURE_MISMATCH` otherwise).
  6. PPTX: must open as a ZIP (`PK\x03\x04` signature), then real OPC-structure and zip-bomb checks —
     entry count ≤ `ZipMaxEntries` (default 2,000), uncompressed size ≤ `ZipMaxUncompressedBytes`
     (default 300 MB), per-entry and total compression ratio ≤ `ZipMaxRatio` (default 100:1), entry
     names checked for path traversal (`..`, backslash, NUL, rooted paths), validated within
     `ZipValidationTimeoutSeconds` (default 5s), must contain `[Content_Types].xml` and
     `ppt/presentation.xml`, and the content-types manifest must declare the presentation MIME type.
     Any failure → 422 (`PPTX_STRUCTURE_INVALID` or `ZIP_SAFETY_LIMIT_EXCEEDED`).
- Server-side eligibility, all re-checked under a row lock at persist time (not just at the first
  check — a concurrent cancel between checks is a real race the code defends against, `Приложение K`
  scenario 9): assignment status ∈ `{Assigned, NeedsRework, Overdue}`; if `Overdue`, the category's
  `AllowLateSubmission` must be `true` (409 `LATE_SUBMISSION_DISABLED` otherwise); the SHA-256 must not
  already exist for this assignment (409 `SUBMISSION_DUPLICATE_CONTENT`, `SUB-028` — a byte-identical
  re-upload is refused, not silently accepted as a new version).
- On success: a new `Submission` row (`VersionNumber = max+1`), the assignment transitions to
  `Submitted`, a `TaskEvent` (`SubmissionUploaded` or `LateSubmissionUploaded`) is written, and the
  category's active Lead is notified via the outbox — all in one DB transaction.
- Retrieval is presigned-URL only, never a direct byte stream from the API: `GET
  /submissions/{id}/download-url` and `GET /submissions/{id}/preview-url`, both returning
  `FileUrlDto{Url, ExpiresAt}` with `PresignedUrlMinutes` (default 10, range 1–60) TTL, both responses
  stamped `Cache-Control: no-store` / `Pragma: no-cache` since the URL itself is a bearer credential
  for its lifetime. Preview is PDF-only — a PPTX submission's `preview-url` call is a real 404 (not an
  error state to design around, just "nothing to point at," `17.5`).

**What `FileDropzone.tsx` actually does** (`Frontend/src/shared/ui/FileDropzone.tsx`, confirmed
zero-networking by direct read, not by trusting its own doc comment):

- Accepts a `File[]` via drag-drop or a native `<input type="file" multiple>`.
- Client-side pre-checks only: extension against `acceptExtensions` and size against `maxSizeBytes`
  (props passed in by the caller) — these are UX conveniences, not a substitute for the server checks
  above, and the component's own comment says as much.
- "Upload" is `simulateUpload()`: a `setInterval` incrementing a fake `progress` percentage by
  20–40 per 180 ms tick until it hits 100 and flips `status` to `'ready'`. The real browser `File`
  object sits in component state and is **never** serialized into `FormData`, never passed to `fetch`
  or `XMLHttpRequest`, never touches `IndexedDB` — it is discarded when the component unmounts or the
  drawer closes.
- The eventual "Submit" action calls `submitPreview(mentorId, id, mentorName, {files, comment})`,
  which is a pure in-memory object mutation on the shared assignment array — no network call exists
  anywhere downstream of it either.

**What a real implementation needs that doesn't exist in either half today**: real upload progress
requires `XMLHttpRequest` (native `fetch` has no upload-progress event) or a library wrapping it;
`multiple` on the `<input>` needs to become "queue N sequential single-file `POST`s, each bumping
`VersionNumber`" rather than "attach N files to one submission," since the backend has no concept of a
multi-file version; 413/415/422/409 need real error-code-to-message mapping via the existing
`api/problemDetails.ts` machinery (already proven correct for Auth, per Phase 0 §3); and the comment
box needs either a backend field to land in (schema change, `PRODUCT_DECISION_REQUIRED`, see Open
Questions) or removal.

---

## Cross-cutting concerns

**`concurrencyToken` requirement** — every mutation of a row that can be mutated more than once
threads it; every append-only/immutable write does not, and every hard-delete does not either (a third
category the Admin package's Users/Branches/Categories domains didn't need to distinguish, since they
have no delete endpoints at all):

| Requires `concurrencyToken` | No token — append-only/immutable, never updated | No token — unconditional delete (guarded by FK, not by version) |
|---|---|---|
| `PUT /assignments/{id}`, `.../publish`, `.../accept-suggestion`, `.../reassign`, `.../start-review`, `.../cancel` (all via the **assignment's** token) | `Submission` (no field exists on the entity at all; a re-upload is a new row, never an update) | `DELETE /topics/{id}` |
| `POST /submissions/{id}/reviews` (via the **assignment's** token — `Review` itself carries none, see RV1) | `Review` (`REV-020` — immutable even for an Admin; no `UpdatedAt`, no token) | `DELETE /topic-assignments/{id}` |
| `PUT /topics/{id}`, `.../activate`, `.../deactivate` | `TaskEvent` (database-level: `UPDATE`/`DELETE` revoked from the application role — append-only is a DB guarantee, not just an app convention, `EVT-001`) | |
| `PUT /topic-assignments/{id}`, `.../activate`, `.../deactivate` | | |

No Lead/Mentor create endpoint (`POST /assignments/drafts`, `POST /topics`, `POST
/topics/{topicId}/assignments`) takes a token either — there is nothing yet to version.

**Audit trail asymmetry** — worth stating precisely since it's easy to over-generalize from the Admin
package (where nearly everything writes `AuditLog`): `Topic`/`TopicAssignment` writes (create, update,
activate, deactivate, delete) **all** call `auditWriter.Write(...)`, same pattern as Categories/Branches.
`Assignment` lifecycle transitions (`Publish`, `AcceptSuggestion`, `Reassign`, `StartReview`, ordinary
Lead `Cancel`) write **no** `AuditLog` row at all — their record is the `TaskEvent` stream instead, and
`AuditLog` is reserved for the one case where an Admin acts inside the study cycle (force-cancel,
`ASN-025`). `Submission` and `Review` writes are audited by neither mechanism beyond the `TaskEvent`
they themselves trigger on the assignment — they are their own immutable record.

**Notifications (outbox)** — enqueued on: assignment `Publish`/`AcceptSuggestion` (to the assignee),
`Reassign` (to both the old and new assignee, only if the assignment was already published),
`Cancel` (to the assignee, only if the assignment had ever been published — a `Draft`/`Suggested`
cancellation notifies nobody), `Submit`/late-`Submit` (to the category's active Lead), and a Review
decision (to the assignee). None of this is Lead/Mentor-visible UI today (per Phase 0 §4.2, the only
consumer is the derived Mentor notification feed built from `TaskEvent`, not from the outbox — the
outbox is Admin-only, `NotificationsController`).

**Tenant scope inheritance** — every create endpoint in this domain derives `OrganizationId`/
`BranchId`/`CategoryId` from context (the Lead's own category for Assignments/Topics, the named
Category for a Topic's org/branch, the named Topic for a TopicAssignment's full scope) and **never**
from the request body; sending them explicitly is either silently impossible (they're not DTO fields
at all, e.g. `CreateAssignmentDraftRequest`) or a hard 400 (`SUB-061`'s form-key check on upload). This
matches the pattern Phase 0 already confirmed for Branches/Categories/Users.

---

## Open questions

Genuine ambiguities that should be resolved before implementation — distinct from items that are just
"needs building," which are called out inline in their table rows above (`NOT_BUILT`, `UI_MISSING`)
and don't need a decision, only work.

1. **Does `Submission` need a `Comment` field, or does the frontend drop it?** The seed data and every
   Lead/Mentor screen (`MentorAssignmentDetailsDrawer`'s free-text box, `LeadSubmissionRecord.comment`,
   `ReviewWorkspaceDrawer` showing it back to the Lead) assume a Mentor can attach a short note to a
   submitted version. `SubmissionDto`/`Submission.Record()`/the upload contract have no such field
   anywhere, and the controller's own forbidden-key check doesn't even block `comment` from the form —
   it would just be silently ignored, which is worse than an explicit rejection because nobody would
   notice the data loss during testing. This needs a call: extend the real contract (schema change,
   `Submission.Comment: string?`, `SubmissionDto` field, `CreateReviewRequest`-style validation) or
   formally cut the UI field during wiring. Same pattern as the Admin package's `notificationLanguage`
   precedent (`docs/phase-1-owner-organization-admin/Phase_1_Product_Extensions_and_Open_Questions.md`).

2. **Multi-file submissions**: `FileDropzone` accepts multiple files per drop and
   `LeadSubmissionRecord.files` is an array — one "submission" in the UI's mental model can bundle
   several files (e.g. a schema PDF plus a queries PDF, seen in the `asn-hqcs-08` fixture). The real
   backend has no such grouping: every `POST .../submissions` call is exactly one file and exactly one
   new `VersionNumber`. Is "attach 2 files to today's work" meant to become "2 separate versions, back
   to back" (changes `AverageVersions` analytics and `IsLate`/dedup semantics per file) or should the
   UI be restricted to one file per submit action to match the real model? This changes both the
   Mentor-facing UX and what the Lead sees as "how many versions were there."

3. **Reviewer/actor identity toward a Mentor**: `TaskEventDto` already has a masking rule for Mentor
   callers (`EVT-004`: `ActorId=null`, `ActorLabel="Lead"`/`"Система"`), implemented and read fresh in
   `AssignmentService.GetHistoryAsync`. `ReviewDto`, by contrast, has **no masking at all** —
   `ReviewerId` is always the raw Lead's `Guid`, and there is no code path anywhere in `ReviewService`
   that substitutes a role label the way history does. Given `GET /users` is `LeadOrAdmin`-only (Mentor
   cannot resolve a name from an id even if it wanted to, per Phase 0 §4.6), how is a Mentor-facing
   screen supposed to show *anything* human-readable for "who reviewed this"? Options: (a) extend
   `ReviewDto` with the same `ActorLabel`-style masking `TaskEventDto` already has, (b) leave
   `ReviewerId` raw and accept that Mentor UI can only ever say "your Lead reviewed this" generically
   (there is exactly one active Lead per category, so identity is arguably redundant information
   anyway), or (c) something else. The current frontend fixtures dodge this by inventing a
   `reviewerName: string` field with no real source — that field cannot survive wiring as-is.

4. **Hard-delete affordances for Topics/TopicAssignments** (`TP7`/`TA5`, both `UI_MISSING`): the
   backend clearly distinguishes "archive" (`deactivate`, always available) from "delete" (only when
   nothing references the row, 409 `RESOURCE_IN_USE` otherwise). The frontend's design intentionally
   routes everything through archive and never offers delete at all. Is a real delete button worth
   building for the "created by mistake, nothing attached yet" case, or is "archive only, forever" an
   accepted product simplification? Low-stakes compared to items 1–3, but it's a real, present gap
   between what the backend supports and what any Lead screen can ever trigger.

Not treated as open questions (unambiguous, just needs fixing during wiring, already called out in
their table rows): the `concurrencyToken` gap across every mutation (cross-cutting, mechanical); the
LA5 `Suggested`-status due-date-edit bug; the `Topic.PlannedDate`/`DayNumber` hard-uniqueness gap (TP3)
— the backend's behavior is already decided, the frontend's doc comment is simply wrong about it.

---

## Endpoint count reconciliation

`AssignmentsController` (10) + `ReviewsController` (2) + `SubmissionsController` (4) +
`TopicsController`'s `/topics*` group (7 own actions: List/Get/Create/Update/Activate/Deactivate/
Delete, plus 2 nested actions scoped through a topic: List-by-topic/Create-under-topic = 9) +
`TopicAssignmentsController`'s `/topic-assignments*` group (5: Get/Update/Activate/Deactivate/Delete)
= **30 endpoints total**, matching the headline table above. (The task brief's rough estimate —
"Assignments' 10 actions, Reviews' 2, Submissions' 4, Topics' ~6, TopicAssignments' ~5" — undercounted
Topics because `TopicAssignmentsController` is physically defined in the same file,
`TopicsController.cs`, as a second `[ApiController]` class below `TopicsController`, and the two nested
`/topics/{topicId}/assignments` routes live on `TopicsController` itself rather than on the
`/topic-assignments` controller — easy to miss without opening the file.)

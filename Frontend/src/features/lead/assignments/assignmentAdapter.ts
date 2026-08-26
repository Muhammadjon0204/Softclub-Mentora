import type { AssignmentDto, TaskEventDto } from '../../../api/lead/assignments';
import type { ReviewDto } from '../../../api/lead/reviews';
import type { SubmissionDto } from '../../../api/lead/submissions';
import type {
  LeadAssignmentRecord,
  LeadAssignmentSource,
  LeadAssignmentStatus,
  LeadReviewRecord,
  LeadSubmissionRecord,
  LeadTaskEventRecord,
} from '../../../mocks/ui-preview/leadAssignments.preview';

/**
 * DTO -> legacy-shaped UI record mapping, the same "map to the shape components already expect"
 * approach `useBranchesQuery.ts`'s `toBranchDetails()`/`useCategoriesQuery.ts`'s `toCategoryDetails()`
 * already established for Branches/Categories. Every `features/lead*`/`features/mentor*` component
 * keeps reading `LeadAssignmentRecord`/`MentorAssignmentRecord` exactly as before — only what produces
 * that shape changes, from a static preview-store array to these functions over real `AssignmentDto`/
 * `SubmissionDto`/`ReviewDto`/`TaskEventDto` responses.
 */

function toMs(iso: string | null): number | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function toMsRequired(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * `AssignmentDto` has no `allowLateSubmission` field — it's a Category-level setting
 * (`Category.AllowLateSubmission`) never embedded on the assignment, and Categories is out of scope
 * for this pass (see `docs/PHASE_0_INTEGRATION_AUDIT.md` constraints). Defaulted permissive (`true`,
 * matching the overwhelming majority of the old fixture data) so `canSubmit()`'s Overdue-status gate
 * doesn't spuriously hide the (already out-of-scope, SB1-blocked) submission form for most real
 * Overdue assignments. Logged as a new gap in `docs/INTEGRATION_UI_ISSUES.md`.
 */
const ALLOW_LATE_SUBMISSION_DEFAULT = true;

/** Base assignment fields only — `submissions`/`events` are populated separately (see `useSubmissions.ts`/history merging in the scope hooks), never eagerly for every row in a list. */
export function toAssignmentRecord(dto: AssignmentDto): LeadAssignmentRecord {
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    title: dto.title,
    description: dto.description ?? '',
    status: dto.status as LeadAssignmentStatus,
    source: dto.source as LeadAssignmentSource,
    mentorId: dto.assignedToId,
    assignedById: dto.assignedById,
    topicAssignmentId: dto.topicAssignmentId,
    initialDueAt: toMsRequired(dto.initialDueAt),
    currentDueAt: toMsRequired(dto.currentDueAt),
    assignedAt: toMs(dto.assignedAt),
    firstSubmittedAt: toMs(dto.firstSubmittedAt),
    reviewStartedAt: toMs(dto.reviewStartedAt),
    approvedAt: toMs(dto.approvedAt),
    overdueAt: toMs(dto.overdueAt),
    cancelledAt: toMs(dto.cancelledAt),
    cancelReason: dto.cancelReason,
    allowLateSubmission: ALLOW_LATE_SUBMISSION_DEFAULT,
    submissions: [],
    events: [],
    concurrencyToken: dto.concurrencyToken,
  };
}

/**
 * One `SubmissionDto` = one submission version = one file (Phase 1E contract map, Open Question #2 —
 * "resolved": multi-file submissions in the old UI model become multiple submission versions in the
 * real one, which SB2's list already naturally gives). Wrapping the single real file in a one-element
 * `files` array keeps every existing `.files.map(...)` render call site unchanged.
 *
 * `comment` is always `null`: the real `SubmissionDto` has no comment field at all (Open Question #1,
 * "resolved" — not solved here since SB1/the upload contract is out of scope, but rendered honestly as
 * absent rather than showing stale/fake preview text). Logged in `docs/INTEGRATION_UI_ISSUES.md`.
 */
export function toSubmissionRecord(dto: SubmissionDto, review: LeadReviewRecord | null): LeadSubmissionRecord {
  return {
    id: dto.id,
    versionNumber: dto.versionNumber,
    submittedAt: toMsRequired(dto.submittedAt),
    isLate: dto.isLate,
    comment: null,
    files: [
      {
        id: dto.id,
        name: dto.originalFileName,
        extension: dto.fileExtension.replace(/^\./, '').toLowerCase() as 'pdf' | 'pptx',
        sizeLabel: formatFileSizeLabel(dto.fileSizeBytes),
      },
    ],
    review,
  };
}

function formatFileSizeLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} МБ`;
}

/**
 * `ReviewDto.reviewerId` is a raw, unmasked Guid the frontend must never surface as an identity
 * (Phase 1E contract map, Open Question #3 — resolved). `reviewerLabel` is computed by the caller
 * based on who's looking: a Lead viewing their own category's reviews already knows it was their own
 * decision (their own name, or a fixed "Вы" label); a Mentor gets a generic role label
 * ("Руководитель направления") since they cannot resolve `GET /users` to a name at all.
 */
export function toReviewRecord(dto: ReviewDto, reviewerLabel: string): LeadReviewRecord {
  return {
    id: dto.id,
    decision: dto.decision as 'Approved' | 'NeedsRework',
    comment: dto.comment,
    reworkDueAt: toMs(dto.reworkDueAt),
    createdAt: toMsRequired(dto.createdAt),
    reviewerName: reviewerLabel,
  };
}

/**
 * `TaskEventDto.eventType` -> `LeadTaskEventRecord.kind`. The 12 real `TaskEventKind` values match the
 * frontend union by name exactly (Phase 1E contract map, FSM section), so the cast below is a
 * verified-safe rename, not an unchecked assumption.
 *
 * `detail` is always `undefined`: the real `TaskEventDto` carries no free-text detail field (no
 * reassignment target name, no "Версия N" caption, no repeated cancel reason) — those were preview-only
 * embellishments. The assignment's own fields already carry the load-bearing versions of this
 * information (`cancelReason` on the assignment itself, submission `versionNumber` in the submissions
 * list), so nothing is lost, only the inline event-timeline caption. Logged in
 * `docs/INTEGRATION_UI_ISSUES.md`.
 */
export function toTaskEventRecord(dto: TaskEventDto, actorName: string): LeadTaskEventRecord {
  return {
    id: dto.id,
    kind: dto.eventType as LeadTaskEventRecord['kind'],
    occurredAt: toMsRequired(dto.occurredAt),
    actorName,
    detail: undefined,
  };
}

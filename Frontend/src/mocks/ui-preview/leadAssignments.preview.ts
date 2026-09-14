import type { TaskEventKind } from '../../features/admin-assignments/assignmentPresentation';

/**
 * Shared Lead-assignment record shapes. The fixture data this file used to hold (a full
 * hand-built assignment fixture set plus `CATEGORY_LEAD_NAME`/`LEAD_ASSIGNMENTS`, keyed to the
 * old `leadWorkspace.ts` category ids) has been deleted along with its only consumer,
 * `leadScopedData.ts` — every real Lead page now reads assignments from `GET /assignments`
 * (`features/lead/scope/useScopedLeadAssignments.ts`) via `assignmentAdapter.ts`, which builds
 * these same record shapes from real API data. Only the label map below (still consumed
 * app-wide) and the type definitions survive.
 */

export type LeadAssignmentStatus =
  | 'Draft'
  | 'Suggested'
  | 'Assigned'
  | 'Submitted'
  | 'InReview'
  | 'NeedsRework'
  | 'Overdue'
  | 'Approved'
  | 'Cancelled';

export type LeadAssignmentSource = 'Auto' | 'Manual';

export interface LeadSubmissionFile {
  id: string;
  name: string;
  extension: 'pdf' | 'pptx';
  sizeLabel: string;
}

export interface LeadReviewRecord {
  id: string;
  decision: 'Approved' | 'NeedsRework';
  comment: string | null;
  reworkDueAt: number | null;
  createdAt: number;
  reviewerName: string;
}

export interface LeadSubmissionRecord {
  id: string;
  versionNumber: number;
  submittedAt: number;
  isLate: boolean;
  comment: string | null;
  files: LeadSubmissionFile[];
  review: LeadReviewRecord | null;
}

export interface LeadTaskEventRecord {
  id: string;
  kind: TaskEventKind | 'SuggestionAccepted' | 'Reassigned' | 'SuggestedCreated';
  occurredAt: number;
  actorName: string;
  detail?: string;
}

export interface LeadAssignmentRecord {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  status: LeadAssignmentStatus;
  source: LeadAssignmentSource;
  mentorId: string;
  assignedById: string | null;
  topicAssignmentId: string | null;
  initialDueAt: number;
  currentDueAt: number;
  assignedAt: number | null;
  firstSubmittedAt: number | null;
  reviewStartedAt: number | null;
  approvedAt: number | null;
  overdueAt: number | null;
  cancelledAt: number | null;
  cancelReason: string | null;
  allowLateSubmission: boolean;
  submissions: LeadSubmissionRecord[];
  events: LeadTaskEventRecord[];
  /**
   * Real `AssignmentDto.concurrencyToken` — required by every mutation (`publish`, `accept-suggestion`,
   * `reassign`, `start-review`, `cancel`, `PUT`). Optional here only for callers that build a partial
   * record; every real record from `assignmentAdapter.ts` always sets it.
   */
  concurrencyToken?: string;
}

export const LEAD_ASSIGNMENT_STATUS_LABEL: Record<LeadAssignmentStatus, string> = {
  Draft: 'Черновик',
  Suggested: 'Предложено',
  Assigned: 'Назначено',
  Submitted: 'Отправлено',
  InReview: 'На проверке',
  NeedsRework: 'На доработке',
  Overdue: 'Просрочено',
  Approved: 'Одобрено',
  Cancelled: 'Отменено',
};

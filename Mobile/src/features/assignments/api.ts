import { apiFetch } from '@/lib/api';
import { branchHeader } from '@/lib/branchScope';

/** `AssignmentDto` — only the fields the app reads (`Frontend/src/api/lead/assignments.ts` has them all). */
export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  status: AssignmentStatus;
  source: string;
  initialDueAt: string;
  currentDueAt: string;
  assignedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  branch: { id: string; name: string } | null;
  assignedByRole?: string | null;
  branchId: string;
  categoryId: string;
  assignedToId: string;
  assignedById: string | null;
  firstSubmittedAt: string | null;
  concurrencyToken: string;
  /** The server's own answer to «may this person lead the task»: review it, move it. */
  canManage?: boolean;
}

export type AssignmentStatus =
  | 'Draft'
  | 'Suggested'
  | 'Assigned'
  | 'Submitted'
  | 'InReview'
  | 'NeedsRework'
  | 'Overdue'
  | 'Approved'
  | 'Cancelled';

/** `TaskEventDto`: for a mentor the server masks the actor — `actorLabel` says «Lead»/«Система». */
export interface TaskEvent {
  id: string;
  eventType: string;
  actorId?: string | null;
  actorLabel: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  occurredAt: string;
  previousDueAt?: string | null;
  newDueAt?: string | null;
  reason?: string | null;
}

interface Paged<T> {
  items: T[];
  totalCount: number;
}

const PAGE_SIZE = 100;
/** Enough for years of one branch's work; a phone should not pull more than this at once. */
const MAX_PAGES = 5;

async function allPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  const separator = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await apiFetch<Paged<T>>(`${path}${separator}page=${page}&pageSize=${PAGE_SIZE}`);
    items.push(...result.items);
    if (items.length >= result.totalCount || result.items.length === 0) break;
  }
  return items;
}

/**
 * What the person may see: a mentor asks for their own work; a lead and an administrator get what the
 * server's scope allows them — the team, the branch, or the whole organization.
 */
export function listAssignments(user: { id: string; role: string }): Promise<Assignment[]> {
  return allPages<Assignment>(
    user.role === 'Mentor' ? `/api/v1/assignments?assignedToId=${encodeURIComponent(user.id)}` : '/api/v1/assignments',
  );
}

export interface Person {
  id: string;
  fullName: string;
}

/** Names for the lists of a lead or an administrator; mentors have no access to this endpoint. */
export function listPeople(): Promise<Person[]> {
  return allPages<Person>('/api/v1/users');
}

export interface Submission {
  id: string;
  versionNumber: number;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  comment: string | null;
  isLate: boolean;
  submittedAt: string;
}

export function listSubmissions(assignmentId: string): Promise<Submission[]> {
  return apiFetch<Submission[]>(`/api/v1/assignments/${encodeURIComponent(assignmentId)}/submissions`);
}

/** A short-lived link to the file in storage — fetched at the moment of opening, never kept. */
export function getDownloadUrl(submissionId: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/api/v1/submissions/${encodeURIComponent(submissionId)}/download-url`);
}

export interface ReviewDecision {
  decision: 'Approved' | 'NeedsRework';
  comment: string | null;
  reworkDueAt: string | null;
}

/**
 * Takes the work into review if nobody has yet, then records the decision — the same two server steps
 * the site takes. `scopeBranchId` is for an organization administrator only: their changes must name
 * the branch, and the header is refused from every other role.
 */
export async function decideReview(
  assignment: Assignment,
  submissionId: string,
  decision: ReviewDecision,
  scopeBranchId: string | null,
): Promise<void> {
  const headers = branchHeader(scopeBranchId);
  let token = assignment.concurrencyToken;

  if (assignment.status === 'Submitted') {
    const started = await apiFetch<Assignment>(`/api/v1/assignments/${assignment.id}/start-review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ concurrencyToken: token }),
    });
    token = started.concurrencyToken;
  }

  await apiFetch(`/api/v1/submissions/${submissionId}/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...decision, concurrencyToken: token }),
  });
}

export function getAssignment(id: string): Promise<Assignment> {
  return apiFetch<Assignment>(`/api/v1/assignments/${encodeURIComponent(id)}`);
}

export function getAssignmentHistory(id: string): Promise<TaskEvent[]> {
  return apiFetch<TaskEvent[]>(`/api/v1/assignments/${encodeURIComponent(id)}/history`);
}

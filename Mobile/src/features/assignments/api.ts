import { apiFetch } from '@/lib/api';

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
  firstSubmittedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  branch: { id: string; name: string } | null;
  assignedByRole?: string | null;
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

/** The mentor's own assignments — the same call the site's «Мои задания» makes (page size 100). */
export async function listMyAssignments(mentorId: string): Promise<Assignment[]> {
  const page = await apiFetch<Paged<Assignment>>(`/api/v1/assignments?pageSize=100&assignedToId=${encodeURIComponent(mentorId)}`);
  return page.items;
}

export function getAssignment(id: string): Promise<Assignment> {
  return apiFetch<Assignment>(`/api/v1/assignments/${encodeURIComponent(id)}`);
}

export function getAssignmentHistory(id: string): Promise<TaskEvent[]> {
  return apiFetch<TaskEvent[]>(`/api/v1/assignments/${encodeURIComponent(id)}/history`);
}

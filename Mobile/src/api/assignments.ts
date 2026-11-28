import { apiSend } from '@/lib/api';
import type { Assignment } from '@/features/assignments/api';

/** The issuer's actions on a task; each answers with the updated assignment. */
const act = (assignment: Assignment, action: string, body: Record<string, unknown>, method: 'POST' | 'PUT' = 'POST') =>
  apiSend<Assignment>(method, `/api/v1/assignments/${assignment.id}${action}`, { ...body, concurrencyToken: assignment.concurrencyToken }, assignment.branchId);

export interface NewAssignment {
  assignedToId: string;
  title: string;
  description: string | null;
  dueAt: string;
}

/**
 * A draft, then publish — the same two calls the site makes. Without `publish` it stays a draft.
 * `categoryId` names which of the assignee's teams the task belongs to; it is fixed once created.
 */
export async function issueAssignment(
  input: NewAssignment & { categoryId: string },
  branchId: string | null,
  publish: boolean,
): Promise<Assignment> {
  const draft = await apiSend<Assignment>('POST', '/api/v1/assignments/drafts', { ...input, topicAssignmentId: null }, branchId);
  return publish ? act(draft, '/publish', {}) : draft;
}

export const publishAssignment = (a: Assignment) => act(a, '/publish', {});
export const acceptSuggestion = (a: Assignment) => act(a, '/accept-suggestion', {});
export const updateDraft = (a: Assignment, input: NewAssignment) => act(a, '', { ...input }, 'PUT');
export const editDetails = (a: Assignment, title: string, description: string | null) => act(a, '/details', { title, description }, 'PUT');
export const reschedule = (a: Assignment, dueAt: string, reason: string) => act(a, '/reschedule', { dueAt, reason });
export const reassign = (a: Assignment, assignedToId: string) => act(a, '/reassign', { assignedToId });
export const cancelAssignment = (a: Assignment, cancelReason: string) => act(a, '/cancel', { cancelReason });

/** `file` is what `expo-document-picker` returns; React Native's FormData takes `{ uri, name, type }`. */
export function submitWork(assignmentId: string, file: { uri: string; name: string; mimeType?: string; file?: Blob } | null, comment: string) {
  const form = new FormData();
  if (file) {
    // On web the picker hands over a real File; on a phone a local URI.
    if (file.file) form.append('file', file.file, file.name);
    else form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  }
  if (comment.trim()) form.append('comment', comment.trim());
  return apiSend<unknown>('POST', `/api/v1/assignments/${assignmentId}/submissions`, form);
}

import { apiClient } from '../client';
import type { TopicAssignmentDto } from './topics';

export type { TopicAssignmentDto };

/**
 * `TopicAssignmentsController` (bottom half of `TopicsController.cs`, same file server-side). TA1–TA5.
 * A template is a snapshot source, not the task — editing or archiving one never touches assignments
 * already created from it (`TPL-004`).
 */
export interface UpdateTopicAssignmentRequest {
  type: 'Presentation' | 'ClassTask' | 'HomeTask';
  title: string;
  description?: string | null;
  isRequired: boolean;
  concurrencyToken: string;
}

export interface ScheduleActionRequest {
  concurrencyToken: string;
}

/** TA1: `GET /topic-assignments/{id}`. */
export async function getTopicAssignment(id: string): Promise<TopicAssignmentDto> {
  const { data } = await apiClient.get<TopicAssignmentDto>(`/api/v1/topic-assignments/${id}`);
  return data;
}

/** TA2: `PUT /topic-assignments/{id}`. Editing never touches assignments already created from this template (`TPL-004`). */
export async function updateTopicAssignment(id: string, request: UpdateTopicAssignmentRequest): Promise<TopicAssignmentDto> {
  const { data } = await apiClient.put<TopicAssignmentDto>(`/api/v1/topic-assignments/${id}`, request);
  return data;
}

/** TA3: `POST /topic-assignments/{id}/activate`. */
export async function activateTopicAssignment(id: string, request: ScheduleActionRequest): Promise<TopicAssignmentDto> {
  const { data } = await apiClient.post<TopicAssignmentDto>(`/api/v1/topic-assignments/${id}/activate`, request);
  return data;
}

/** TA4: `POST /topic-assignments/{id}/deactivate` — stops auto-generation and new-assignment pickers, existing assignments untouched (`TPL-003`). */
export async function deactivateTopicAssignment(id: string, request: ScheduleActionRequest): Promise<TopicAssignmentDto> {
  const { data } = await apiClient.post<TopicAssignmentDto>(`/api/v1/topic-assignments/${id}/deactivate`, request);
  return data;
}

/**
 * TA5: `DELETE /topic-assignments/{id}` — 204; 409 `RESOURCE_IN_USE` if any reference remains
 * (`TPL-002`). Exported for completeness, no UI trigger wired — same gap as `deleteTopic`, see
 * `docs/INTEGRATION_UI_ISSUES.md`.
 */
export async function deleteTopicAssignment(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/topic-assignments/${id}`);
}

import { apiClient } from '../client';

/**
 * `Backend/src/MentorTaskFlow.Contracts/Schedule/ScheduleDtos.cs`, `TopicsController` (top half of
 * `TopicsController.cs`). TP1–TP9. Mentor is read-only across this whole domain — `EnsureMayWriteSchedule`
 * enforces this server-side even if a write action were somehow reached client-side.
 */
export interface TopicDto {
  id: string;
  organizationId: string;
  branchId: string;
  categoryId: string;
  dayNumber: number;
  /** `DateOnly?` on the wire — `"YYYY-MM-DD"` or `null`, genuinely optional (unlike the old preview fixture's always-populated `plannedDate`). */
  plannedDate: string | null;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
  branch: { id: string; name: string; code: string; isHeadOffice: boolean } | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface TopicListQuery {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  isActive?: boolean;
  sort?: string;
  order?: string;
}

/** TP3: `POST /topics`. */
export interface CreateTopicRequest {
  categoryId: string;
  dayNumber: number;
  plannedDate?: string | null;
  title: string;
  description?: string | null;
}

/**
 * TP4: `PUT /topics/{id}`. Category is not editable (`TOPIC-005`). Moving `plannedDate` does not
 * shift already-created assignments' deadlines.
 */
export interface UpdateTopicRequest {
  dayNumber: number;
  plannedDate?: string | null;
  title: string;
  description?: string | null;
  concurrencyToken: string;
}

export interface ScheduleActionRequest {
  concurrencyToken: string;
}

/** TA1's sibling type — see `topicAssignments.ts`. Kept here too since `TP9`'s response is this shape. */
export interface TopicAssignmentDto {
  id: string;
  topicId: string;
  organizationId: string;
  branchId: string;
  categoryId: string;
  type: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
}

/** TP9: `POST /topics/{topicId}/assignments`. Scope inherited from the topic in the route — never sent in the body (`TPL-001`/`TPL-005`). */
export interface CreateTopicAssignmentRequest {
  type: 'Presentation' | 'ClassTask' | 'HomeTask';
  title: string;
  description?: string | null;
  isRequired?: boolean;
}

function toQueryParams(query: TopicListQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.pageSize = query.pageSize;
  if (query.categoryId !== undefined) params.categoryId = query.categoryId;
  if (query.isActive !== undefined) params.isActive = query.isActive;
  if (query.sort !== undefined) params.sort = query.sort;
  if (query.order !== undefined) params.order = query.order;
  return params;
}

/** TP1: `GET /topics`. */
export async function listTopics(query: TopicListQuery = {}): Promise<PagedResult<TopicDto>> {
  const { data } = await apiClient.get<PagedResult<TopicDto>>('/api/v1/topics', { params: toQueryParams(query) });
  return data;
}

/** TP2: `GET /topics/{id}`. */
export async function getTopic(id: string): Promise<TopicDto> {
  const { data } = await apiClient.get<TopicDto>(`/api/v1/topics/${id}`);
  return data;
}

/**
 * TP3: `POST /topics`. The backend enforces TWO separate hard unique constraints per category —
 * `ux_topics_category_planned_date` (`plannedDate`) and `ux_topics_category_day` (`dayNumber`) — both
 * returned as 409 `RESOURCE_ALREADY_EXISTS` with distinct messages. This is a genuine blocking error,
 * not a soft warning (the old preview store's doc comment claiming otherwise was wrong — see
 * `useTopicActions.ts`, which surfaces this via the standard `getGenericErrorMessage` toast/banner path
 * rather than silently succeeding the way the preview store used to).
 */
export async function createTopic(request: CreateTopicRequest): Promise<TopicDto> {
  const { data } = await apiClient.post<TopicDto>('/api/v1/topics', request);
  return data;
}

/** TP4: `PUT /topics/{id}`. Same two hard uniqueness constraints as TP3 apply on edit. */
export async function updateTopic(id: string, request: UpdateTopicRequest): Promise<TopicDto> {
  const { data } = await apiClient.put<TopicDto>(`/api/v1/topics/${id}`, request);
  return data;
}

/** TP5: `POST /topics/{id}/activate`. */
export async function activateTopic(id: string, request: ScheduleActionRequest): Promise<TopicDto> {
  const { data } = await apiClient.post<TopicDto>(`/api/v1/topics/${id}/activate`, request);
  return data;
}

/** TP6: `POST /topics/{id}/deactivate` — archives; stops feeding auto-generation and pickers, stays visible (`TOPIC-013`). */
export async function deactivateTopic(id: string, request: ScheduleActionRequest): Promise<TopicDto> {
  const { data } = await apiClient.post<TopicDto>(`/api/v1/topics/${id}/deactivate`, request);
  return data;
}

/**
 * TP7: `DELETE /topics/{id}` — 204; 409 `RESOURCE_IN_USE` if anything still references the topic
 * (`TOPIC-003`). Exported for completeness of the client (the real backend capability exists) but no
 * UI trigger is wired to it in this pass — same treatment as the already-logged `make-head-office`/
 * `activate-deactivated-user` gaps in `docs/INTEGRATION_UI_ISSUES.md` (see the new entry added there
 * for this one).
 */
export async function deleteTopic(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/topics/${id}`);
}

/** TP8: `GET /topics/{topicId}/assignments` — the templates of one topic. */
export async function listTopicAssignmentsOfTopic(topicId: string): Promise<TopicAssignmentDto[]> {
  const { data } = await apiClient.get<TopicAssignmentDto[]>(`/api/v1/topics/${topicId}/assignments`);
  return data;
}

/** TP9: `POST /topics/{topicId}/assignments`. */
export async function createTopicAssignment(topicId: string, request: CreateTopicAssignmentRequest): Promise<TopicAssignmentDto> {
  const { data } = await apiClient.post<TopicAssignmentDto>(`/api/v1/topics/${topicId}/assignments`, request);
  return data;
}

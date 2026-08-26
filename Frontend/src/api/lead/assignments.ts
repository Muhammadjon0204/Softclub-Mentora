import { apiClient } from '../client';

/** Same shape as every other paged endpoint (`api/admin/users.ts`, `api/admin/categories.ts`) — each domain module defines its own copy rather than importing across domains, matching existing precedent. */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * `Backend/src/MentorTaskFlow.Contracts/Assignments/AssignmentDtos.cs`. Lives under `api/lead/`, not
 * `api/admin/` — unlike Branches/Categories/Users/Organization (genuinely Admin-owned domains this
 * app already wires under `api/admin/`), the assignment lifecycle belongs to Lead/Mentor (`AssignmentsController`
 * policies are `Lead`/`LeadOrAdmin`/`Mentor`/`Authenticated`, never `AnyAdmin`). An Organization/Branch
 * Admin only ever touches this domain through the already-cataloged force-cancel path (`AS8`, Admin
 * package) — everything else here is read or written by Lead/Mentor. See the Phase 1E contract map
 * (`docs/PHASE_1E_LEAD_MENTOR_CONTRACT_MAP.md`) for the full endpoint catalog this file implements (LA1–LA10).
 */
export interface AssignmentDto {
  id: string;
  organizationId: string;
  branchId: string;
  categoryId: string;
  topicAssignmentId: string | null;
  assignedToId: string;
  assignedById: string | null;
  title: string;
  description: string | null;
  status: string;
  source: string;
  initialDueAt: string;
  currentDueAt: string;
  generatedForDate: string | null;
  assignedAt: string | null;
  firstSubmittedAt: string | null;
  reviewStartedAt: string | null;
  approvedAt: string | null;
  overdueAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  concurrencyToken: string;
  branch: { id: string; name: string; code: string; isHeadOffice: boolean } | null;
}

/**
 * `EVT-004`: for a Mentor caller, `actorId` is always `null` and `actorLabel` carries the role
 * (`"Lead"`/`"Система"`) instead — masking is done server-side, this type only mirrors it. For a
 * Lead/Admin caller it's the reverse: `actorId` is the raw actor id and `actorLabel` is always `null`.
 */
export interface TaskEventDto {
  id: string;
  sequenceNumber: number;
  eventType: string;
  actorId: string | null;
  actorLabel: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  occurredAt: string;
  correlationId: string;
}

export interface AssignmentListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  categoryId?: string;
  assignedToId?: string;
  source?: string;
  sort?: string;
  order?: string;
}

/** LA4: `POST /assignments/drafts` — Lead only, scope derived from the caller's own category. */
export interface CreateAssignmentDraftRequest {
  assignedToId: string;
  topicAssignmentId?: string | null;
  title?: string | null;
  description?: string | null;
  dueAt?: string | null;
}

/** LA5: `PUT /assignments/{id}` — Draft/Suggested only. `dueAt` is always sent, never conditional on status (see LA5 fix note in useAssignmentActions.ts). */
export interface UpdateAssignmentRequest {
  assignedToId: string;
  title: string;
  description: string | null;
  dueAt: string;
  concurrencyToken: string;
}

export interface ReassignAssignmentRequest {
  assignedToId: string;
  concurrencyToken: string;
  reason?: string | null;
}

export interface CancelAssignmentRequest {
  cancelReason: string;
  concurrencyToken: string;
}

export interface AssignmentActionRequest {
  concurrencyToken: string;
}

function toQueryParams(query: AssignmentListQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.pageSize = query.pageSize;
  if (query.status !== undefined) params.status = query.status;
  if (query.categoryId !== undefined) params.categoryId = query.categoryId;
  if (query.assignedToId !== undefined) params.assignedToId = query.assignedToId;
  if (query.source !== undefined) params.source = query.source;
  if (query.sort !== undefined) params.sort = query.sort;
  if (query.order !== undefined) params.order = query.order;
  return params;
}

/**
 * LA1: `GET /assignments` — scoped server-side per caller (`AssignmentService.ApplyVisibility`):
 * Lead sees only their own category (all statuses, including Draft/Suggested), Mentor sees only their
 * own tasks with Draft/Suggested already excluded. Neither role needs to pass `categoryId`/`assignedToId`
 * client-side — the scoping happens whether or not the filter is supplied.
 */
export async function listAssignments(query: AssignmentListQuery = {}): Promise<PagedResult<AssignmentDto>> {
  const { data } = await apiClient.get<PagedResult<AssignmentDto>>('/api/v1/assignments', { params: toQueryParams(query) });
  return data;
}

/** LA2: `GET /assignments/{id}`. */
export async function getAssignment(id: string): Promise<AssignmentDto> {
  const { data } = await apiClient.get<AssignmentDto>(`/api/v1/assignments/${id}`);
  return data;
}

/** LA3: `GET /assignments/{id}/history` — sequence-ordered `TaskEvent`s, `EVT-004`-masked for a Mentor caller. */
export async function getAssignmentHistory(id: string): Promise<TaskEventDto[]> {
  const { data } = await apiClient.get<TaskEventDto[]>(`/api/v1/assignments/${id}/history`);
  return data;
}

/** LA4: `POST /assignments/drafts` — Lead only. 201, `AssignmentDto` of the new Draft. */
export async function createAssignmentDraft(request: CreateAssignmentDraftRequest): Promise<AssignmentDto> {
  const { data } = await apiClient.post<AssignmentDto>('/api/v1/assignments/drafts', request);
  return data;
}

/** LA5: `PUT /assignments/{id}` — Lead only, Draft/Suggested only. */
export async function updateAssignment(id: string, request: UpdateAssignmentRequest): Promise<AssignmentDto> {
  const { data } = await apiClient.put<AssignmentDto>(`/api/v1/assignments/${id}`, request);
  return data;
}

/** LA6: `POST /assignments/{id}/publish` — Draft -> Assigned. */
export async function publishAssignment(id: string, request: AssignmentActionRequest): Promise<AssignmentDto> {
  const { data } = await apiClient.post<AssignmentDto>(`/api/v1/assignments/${id}/publish`, request);
  return data;
}

/** LA7: `POST /assignments/{id}/accept-suggestion` — Suggested -> Assigned, writes two TaskEvents server-side (`EVT-005`). */
export async function acceptAssignmentSuggestion(id: string, request: AssignmentActionRequest): Promise<AssignmentDto> {
  const { data } = await apiClient.post<AssignmentDto>(`/api/v1/assignments/${id}/accept-suggestion`, request);
  return data;
}

/** LA8: `POST /assignments/{id}/reassign` — Draft/Suggested always, Assigned only if no submission exists yet. */
export async function reassignAssignment(id: string, request: ReassignAssignmentRequest): Promise<AssignmentDto> {
  const { data } = await apiClient.post<AssignmentDto>(`/api/v1/assignments/${id}/reassign`, request);
  return data;
}

/** LA9: `POST /assignments/{id}/start-review` — Submitted -> InReview, explicit action only (`REV-001`). */
export async function startAssignmentReview(id: string, request: AssignmentActionRequest): Promise<AssignmentDto> {
  const { data } = await apiClient.post<AssignmentDto>(`/api/v1/assignments/${id}/start-review`, request);
  return data;
}

/**
 * LA10: `POST /assignments/{id}/cancel` — Lead (own category) or Admin (force-cancel, cataloged
 * separately as `AS8`). `cancelReason` 5–500 chars. Ordinary Lead cancel writes a `TaskEvent` and a
 * notification but no `AuditLog` row — `AuditLog` is reserved for the Admin force-cancel path.
 */
export async function cancelAssignment(id: string, request: CancelAssignmentRequest): Promise<AssignmentDto> {
  const { data } = await apiClient.post<AssignmentDto>(`/api/v1/assignments/${id}/cancel`, request);
  return data;
}

import { apiClient } from '../client';

/**
 * `Backend/src/MentorTaskFlow.Contracts/Categories/CategoryDtos.cs`. У Category нет поля
 * «руководитель» — это факт о `User.CategoryId` + `User.Role=Lead`, см. `useCategoriesQuery.ts`.
 */
export interface CategoryDto {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
  /** Заполнено только в all-branches read-контексте (Organization Admin без выбранного филиала). */
  branch: { id: string; name: string; code: string; isHeadOffice: boolean } | null;
}

/**
 * `CategorySettings` — отдельный агрегат со своим `concurrencyToken`, не часть `CategoryDto`
 * (`GET/PUT /categories/{id}/settings` — отдельные routes). `defaultDueTimeLocal` — `HH:mm`.
 */
export interface CategorySettingsDto {
  categoryId: string;
  timeZoneId: string;
  defaultAssignmentDueDays: number;
  defaultDueTimeLocal: string;
  deadlineReminderHours: number;
  allowLateSubmission: boolean;
  updatedAt: string;
  concurrencyToken: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CategoryListQuery {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  sort?: string;
  order?: string;
}

/** POST /categories — без `organizationId`/`branchId`: Branch Admin берёт свой филиал, Organization Admin обязан выбрать (`X-MTF-Branch-Id`, иначе 400 `BRANCH_CONTEXT_REQUIRED`). */
export interface CreateCategoryRequest {
  name: string;
  description: string | null;
}

export interface UpdateCategoryRequest {
  name: string;
  description: string | null;
  concurrencyToken: string;
}

/** 409 `CATEGORY_HAS_ACTIVE_USERS`, если есть активные пользователи и `confirmActiveUsers` не `true`. */
export interface DeactivateCategoryRequest {
  concurrencyToken: string;
  confirmActiveUsers?: boolean;
}

export interface CategoryActionRequest {
  concurrencyToken: string;
}

export interface UpdateCategorySettingsRequest {
  timeZoneId: string;
  defaultAssignmentDueDays: number;
  defaultDueTimeLocal: string;
  deadlineReminderHours: number;
  allowLateSubmission: boolean;
  concurrencyToken: string;
}

function toQueryParams(query: CategoryListQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.pageSize = query.pageSize;
  if (query.isActive !== undefined) params.isActive = query.isActive;
  if (query.sort !== undefined) params.sort = query.sort;
  if (query.order !== undefined) params.order = query.order;
  return params;
}

/**
 * GET /categories — Authenticated (любая роль). Lead/Mentor видят только свою категорию.
 * Для Admin результат зависит от текущего branch-context: конкретный филиал сужает список,
 * «Все филиалы» отдаёт категории всей организации — поэтому query key вызывающего хука
 * обязан быть branch-scoped (`branchScopedKey`), иначе кэш не обновится при смене филиала.
 *
 * `branchId` — необязательный явный override заголовка `X-MTF-Branch-Id` для этого конкретного
 * запроса, в обход текущего глобального branch-context (`branchHeaderInterceptor.ts` уважает уже
 * установленный заголовок) — нужен диалогам вроде смены роли/перевода пользователя, где
 * Organization Admin выбирает целевой филиал внутри диалога и категория должна резолвиться
 * именно для НЕГО, а не для того, что сейчас выбрано в шапке.
 */
export async function listCategories(query: CategoryListQuery = {}, branchId?: string): Promise<PagedResult<CategoryDto>> {
  const headers = branchId !== undefined ? { 'X-MTF-Branch-Id': branchId } : undefined;
  const { data } = await apiClient.get<PagedResult<CategoryDto>>('/api/v1/categories', { params: toQueryParams(query), headers });
  return data;
}

export async function getCategory(id: string): Promise<CategoryDto> {
  const { data } = await apiClient.get<CategoryDto>(`/api/v1/categories/${id}`);
  return data;
}

/**
 * POST /categories — 201, отвечает свежим DTO. `CreateCategoryRequest` не содержит `branchId` —
 * сервер решает по `X-MTF-Branch-Id` (Organization Admin, обязателен) или по claims (Branch Admin).
 * `branchId` здесь — необязательный явный override заголовка, см. комментарий у `createUser` в
 * `api/admin/users.ts` — тот же приём.
 */
export async function createCategory(request: CreateCategoryRequest, branchId?: string): Promise<CategoryDto> {
  const headers = branchId !== undefined ? { 'X-MTF-Branch-Id': branchId } : undefined;
  const { data } = await apiClient.post<CategoryDto>('/api/v1/categories', request, { headers });
  return data;
}

export async function updateCategory(id: string, request: UpdateCategoryRequest): Promise<CategoryDto> {
  const { data } = await apiClient.put<CategoryDto>(`/api/v1/categories/${id}`, request);
  return data;
}

export async function activateCategory(id: string, request: CategoryActionRequest): Promise<CategoryDto> {
  const { data } = await apiClient.post<CategoryDto>(`/api/v1/categories/${id}/activate`, request);
  return data;
}

export async function deactivateCategory(id: string, request: DeactivateCategoryRequest): Promise<CategoryDto> {
  const { data } = await apiClient.post<CategoryDto>(`/api/v1/categories/${id}/deactivate`, request);
  return data;
}

export async function getCategorySettings(id: string): Promise<CategorySettingsDto> {
  const { data } = await apiClient.get<CategorySettingsDto>(`/api/v1/categories/${id}/settings`);
  return data;
}

export async function updateCategorySettings(id: string, request: UpdateCategorySettingsRequest): Promise<CategorySettingsDto> {
  const { data } = await apiClient.put<CategorySettingsDto>(`/api/v1/categories/${id}/settings`, request);
  return data;
}

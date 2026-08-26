import { apiClient } from '../client';

/**
 * `Backend/src/MentorTaskFlow.Contracts/Users/UserDtos.cs` — `Role` это `"Admin"|"Lead"|"Mentor"`,
 * `AdminScope` — `"Organization"|"Branch"|null` (заполнен только когда `Role="Admin"`). Плоская UI-модель
 * `PreviewUserRole` (`OrgAdmin|BranchAdmin|Lead|Mentor`) маппится на эту пару на границе API —
 * см. `features/admin-users/useUsersQuery.ts`/`useUserActions.ts`.
 */
export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  role: string;
  adminScope: string | null;
  organizationId: string;
  branchId: string | null;
  categoryId: string | null;
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  concurrencyToken: string;
  /**
   * Заполнено только когда сервер отдаёт «all-branches» контекст (Organization Admin без
   * выбранного филиала) — см. `UserService.ListAsync`/`LoadBranchSummariesAsync` на backend.
   * В остальных случаях `null`, имя филиала резолвится на фронте через `useBranchContext()`.
   */
  branch: { id: string; name: string; code: string; isHeadOffice: boolean } | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  role?: string;
  categoryId?: string;
  isActive?: boolean;
  sort?: string;
  order?: string;
}

/**
 * POST /users — без `organizationId`/`branchId`: сервер решает по claims/`X-MTF-Branch-Id`
 * (заголовок уже проставляет глобальный branch-context интерцептор). `adminScope` валиден
 * только при `role="Admin"`, `categoryId` обязателен для Lead/Mentor и недопустим для Admin.
 * Пароль никогда не передаётся — пользователь получает приглашение на email.
 */
export interface CreateUserRequest {
  fullName: string;
  email: string;
  role: string;
  adminScope?: string | null;
  categoryId?: string | null;
}

/** PATCH /users/{id} — единственное изменяемое поле, ничего больше (`API-009`). */
export interface PatchUserRequest {
  fullName: string;
  concurrencyToken: string;
}

/** `Reason` обязателен, 5–500 символов — реальное аудиторское поле, не формальность. */
export interface ChangeRoleRequest {
  role: string;
  reason: string;
  concurrencyToken: string;
  adminScope?: string | null;
  branchId?: string | null;
  categoryId?: string | null;
}

export interface UserActionRequest {
  concurrencyToken: string;
}

/** Перемещение в пределах того же филиала. */
export interface ChangeCategoryRequest {
  newCategoryId: string;
  reason: string;
  concurrencyToken: string;
}

/** Только Organization Admin. */
export interface ChangeBranchRequest {
  newBranchId: string;
  reason: string;
  concurrencyToken: string;
  newCategoryId?: string | null;
}

function toQueryParams(query: UserListQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.pageSize = query.pageSize;
  if (query.role !== undefined) params.role = query.role;
  if (query.categoryId !== undefined) params.categoryId = query.categoryId;
  if (query.isActive !== undefined) params.isActive = query.isActive;
  if (query.sort !== undefined) params.sort = query.sort;
  if (query.order !== undefined) params.order = query.order;
  return params;
}

/** GET /users — LeadOrAdmin. Список уже отфильтрован сервером под scope вызывающего (branch/organization). */
export async function listUsers(query: UserListQuery = {}): Promise<PagedResult<UserDto>> {
  const { data } = await apiClient.get<PagedResult<UserDto>>('/api/v1/users', { params: toQueryParams(query) });
  return data;
}

export async function getUser(id: string): Promise<UserDto> {
  const { data } = await apiClient.get<UserDto>(`/api/v1/users/${id}`);
  return data;
}

/**
 * POST /users — 201, отвечает свежим DTO. `CreateUserRequest` не содержит `branchId` вообще —
 * сервер решает по `X-MTF-Branch-Id` (Organization Admin) или по claims (Branch Admin/Lead), см.
 * `UserService.BuildNewUserAsync`. `branchId` здесь — необязательный явный override заголовка для
 * этого конкретного запроса (форма создания пользователя даёт Organization Admin выбрать филиал
 * независимо от текущего глобального branch-context — см. `branchHeaderInterceptor.ts`, который
 * уважает уже установленный заголовок).
 */
export async function createUser(request: CreateUserRequest, branchId?: string): Promise<UserDto> {
  const headers = branchId !== undefined ? { 'X-MTF-Branch-Id': branchId } : undefined;
  const { data } = await apiClient.post<UserDto>('/api/v1/users', request, { headers });
  return data;
}

export async function patchUser(id: string, request: PatchUserRequest): Promise<UserDto> {
  const { data } = await apiClient.patch<UserDto>(`/api/v1/users/${id}`, request);
  return data;
}

export async function activateUser(id: string, request: UserActionRequest): Promise<UserDto> {
  const { data } = await apiClient.post<UserDto>(`/api/v1/users/${id}/activate`, request);
  return data;
}

/** Завершает все сессии пользователя немедленно. Разрешено даже для последнего Lead/Admin. */
export async function deactivateUser(id: string, request: UserActionRequest): Promise<UserDto> {
  const { data } = await apiClient.post<UserDto>(`/api/v1/users/${id}/deactivate`, request);
  return data;
}

/** Назначение `Role=Admin` серверно ограничено Organization Admin — иначе 403. */
export async function changeUserRole(id: string, request: ChangeRoleRequest): Promise<UserDto> {
  const { data } = await apiClient.post<UserDto>(`/api/v1/users/${id}/change-role`, request);
  return data;
}

/**
 * Экспортируется для полноты клиента (перечень всех routes контракта) — UI-виджет для
 * «чистой» смены категории без смены роли пока отсутствует, см.
 * `docs/phase-1-owner-organization-admin/Phase_1_Product_Extensions_and_Open_Questions.md` §2.4
 * (`UI_MISSING`, не входит в скоуп этой интеграции).
 */
export async function changeUserCategory(id: string, request: ChangeCategoryRequest): Promise<UserDto> {
  const { data } = await apiClient.post<UserDto>(`/api/v1/users/${id}/change-category`, request);
  return data;
}

/** Только Organization Admin. */
export async function changeUserBranch(id: string, request: ChangeBranchRequest): Promise<UserDto> {
  const { data } = await apiClient.post<UserDto>(`/api/v1/users/${id}/change-branch`, request);
  return data;
}

/** POST /users/{id}/resend-invitation — 202. Валиден только для пользователя, ещё не установившего пароль. */
export async function resendInvitation(id: string): Promise<void> {
  await apiClient.post(`/api/v1/users/${id}/resend-invitation`);
}

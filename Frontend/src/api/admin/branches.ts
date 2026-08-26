import { apiClient } from '../client';

export interface BranchListItemDto {
  id: string;
  name: string;
  code: string;
  isHeadOffice: boolean;
  isActive: boolean;
}

/**
 * GET /api/v1/branches — только Organization Admin (используется branch selector'ом,
 * `features/branch-context/BranchContext.tsx`). Тип и функция намеренно не тронуты
 * при расширении этого файла под /admin/branches — иначе рискуем сломать уже
 * рабочий selector, который передаёт `listBranches` напрямую как `queryFn`.
 */
export async function listBranches(): Promise<BranchListItemDto[]> {
  const { data } = await apiClient.get<{ items: BranchListItemDto[] }>('/api/v1/branches');
  return data.items;
}

/** Полный профиль филиала — то, что backend отдаёт Organization Admin (список и detail). */
export interface BranchDto {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  timeZoneId: string;
  isHeadOffice: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
}

/** Минимальный профиль — то, что видит Lead/Mentor/Branch Admin про свой собственный филиал. */
export interface BranchSummaryDto {
  id: string;
  name: string;
  code: string;
  isHeadOffice: boolean;
}

/** POST /branches — NOTE: backend не знает про city/contactEmail/contactPhone/adminOption/adminUserId,
 * см. docs/phase-1-owner-organization-admin/Phase_1_Product_Extensions_and_Open_Questions.md §1.1/§1.2. */
export interface CreateBranchRequest {
  name: string;
  code: string;
  address: string | null;
  timeZoneId: string;
}

export interface UpdateBranchRequest {
  name: string;
  code: string;
  address: string | null;
  timeZoneId: string;
  concurrencyToken: string;
}

export interface BranchActionRequest {
  concurrencyToken: string;
}

/** 409 BRANCH_HAS_ACTIVE_USERS, если у филиала есть активные пользователи и `confirmActiveUsers` не передан `true`. */
export interface DeactivateBranchRequest {
  concurrencyToken: string;
  confirmActiveUsers?: boolean;
}

/**
 * Тот же эндпоинт, что и `listBranches()`, но с полным `BranchDto` на элемент —
 * тот же принцип, что и у `GET /organization` (summary для остальных, полный DTO
 * для admin): Organization Admin получает от backend полную запись каждого
 * филиала, включая `concurrencyToken`, нужный странице /admin/branches для
 * последующих mutate-вызовов. Отдельная функция, а не замена `listBranches()`, —
 * чтобы не трогать контракт, на который уже завязан branch-context selector.
 *
 * Без пагинации: `BranchListQuery.PageSize` по умолчанию 20 на backend, а в UI
 * /admin/branches нет контролов пагинации (как и у уже рабочего selector'а
 * выше) — при реальном превышении 20 филиалов потребуется добавить пагинацию
 * в UI, это не сделано в рамках этой интеграции.
 */
export async function listBranchesDetailed(): Promise<BranchDto[]> {
  const { data } = await apiClient.get<{ items: BranchDto[] }>('/api/v1/branches');
  return data.items;
}

/**
 * GET /branches/{id} — `Authenticated`, доступно любой роли для собственного
 * филиала (chужой id — 404). Organization Admin получает `BranchDto`,
 * Lead/Mentor/Branch Admin про свой филиал — `BranchSummaryDto`.
 */
export async function getBranch(id: string): Promise<BranchDto | BranchSummaryDto> {
  const { data } = await apiClient.get<BranchDto | BranchSummaryDto>(`/api/v1/branches/${id}`);
  return data;
}

/** POST /branches — только Organization Admin. Отвечает свежим `BranchDto`. */
export async function createBranch(request: CreateBranchRequest): Promise<BranchDto> {
  const { data } = await apiClient.post<BranchDto>('/api/v1/branches', request);
  return data;
}

/** PUT /branches/{id} — только Organization Admin. Отвечает свежим `BranchDto` с новым `concurrencyToken`. */
export async function updateBranch(id: string, request: UpdateBranchRequest): Promise<BranchDto> {
  const { data } = await apiClient.put<BranchDto>(`/api/v1/branches/${id}`, request);
  return data;
}

/** POST /branches/{id}/activate — только Organization Admin. */
export async function activateBranch(id: string, request: BranchActionRequest): Promise<BranchDto> {
  const { data } = await apiClient.post<BranchDto>(`/api/v1/branches/${id}/activate`, request);
  return data;
}

/** POST /branches/{id}/deactivate — только Organization Admin. */
export async function deactivateBranch(id: string, request: DeactivateBranchRequest): Promise<BranchDto> {
  const { data } = await apiClient.post<BranchDto>(`/api/v1/branches/${id}/deactivate`, request);
  return data;
}

/** POST /branches/{id}/make-head-office — только Organization Admin. */
export async function makeHeadOfficeBranch(id: string, request: BranchActionRequest): Promise<BranchDto> {
  const { data } = await apiClient.post<BranchDto>(`/api/v1/branches/${id}/make-head-office`, request);
  return data;
}

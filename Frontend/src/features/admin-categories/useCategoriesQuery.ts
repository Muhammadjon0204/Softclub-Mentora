import { useQuery } from '@tanstack/react-query';

import { getCategorySettings, listCategories } from '../../api/admin/categories';
import type { CategoryDto, CategorySettingsDto } from '../../api/admin/categories';
import { listUsers } from '../../api/admin/users';
import type { UserDto } from '../../api/admin/users';
import { useAuth } from '../../auth/useAuth';
import { usersListQueryKey } from '../admin-users/useUsersQuery';
import { branchScopedKey } from '../branch-context/queryKeys';
import { useBranchContext } from '../branch-context/useBranchContext';
import type { PreviewCategoryColor } from '../../mocks/ui-preview/categories.preview';
import { DEFAULT_DUE_DAYS, DEFAULT_DUE_TIME, DEFAULT_TIMEZONE, stableHash } from './categoryPresentation';
import type { PreviewCategoryDetails } from './categoryPresentation';

const MAX_PAGE_SIZE = 100;
const COLOR_CYCLE: PreviewCategoryColor[] = ['indigo', 'blue', 'cyan', 'violet'];

export function categoriesListQueryKey(organizationId: string, selectedBranchId: string | null): readonly unknown[] {
  return branchScopedKey('admin-categories', organizationId, selectedBranchId, 'list');
}

function colorTokenFor(id: string): PreviewCategoryColor {
  return COLOR_CYCLE[stableHash(id) % COLOR_CYCLE.length];
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export interface CategoryLeadInfo {
  leadUserId: string | null;
  leadName: string | null;
  mentorsCount: number;
}

/** У `Category` в backend нет поля «руководитель» вообще — это факт о `User.CategoryId`+`User.Role=Lead` (см. промпт интеграции). Единственный активный Lead на категорию гарантирован партиальным уникальным индексом `ux_users_active_lead_per_category`. */
export function resolveLeadInfo(categoryId: string, users: readonly UserDto[]): CategoryLeadInfo {
  const lead = users.find((candidate) => candidate.role === 'Lead' && candidate.categoryId === categoryId && candidate.isActive);
  const mentorsCount = users.filter((candidate) => candidate.role === 'Mentor' && candidate.categoryId === categoryId && candidate.isActive).length;
  return { leadUserId: lead?.id ?? null, leadName: lead?.fullName ?? null, mentorsCount };
}

/** Собирает `CategoryDto` -> `PreviewCategoryDetails`. Экспортируется для переиспользования в `useCategoryActions.ts`. */
export function toCategoryDetails(
  dto: CategoryDto,
  leadInfo: CategoryLeadInfo,
  resolveBranchName: (branchId: string) => string | null,
  settings?: CategorySettingsDto,
): PreviewCategoryDetails {
  return {
    id: dto.id,
    name: dto.name,
    branchName: dto.branch?.name ?? resolveBranchName(dto.branchId) ?? '—',
    colorToken: colorTokenFor(dto.id),
    leadName: leadInfo.leadName,
    mentorsCount: leadInfo.mentorsCount,
    // Assignments-домен вне скоупа этой интеграции — честные 0, не выдуманные числа (тот же
    // принцип, что и у Branches: docs/INTEGRATION_UI_ISSUES.md).
    activeAssignments: 0,
    pendingReview: 0,
    healthPct: 0,
    isActive: dto.isActive,
    description: dto.description,
    leadUserId: leadInfo.leadUserId,
    createdLabel: formatDateLabel(dto.createdAt),
    timezone: settings?.timeZoneId ?? DEFAULT_TIMEZONE,
    defaultDueTimeLocal: settings?.defaultDueTimeLocal ?? DEFAULT_DUE_TIME,
    defaultDueDays: settings?.defaultAssignmentDueDays ?? DEFAULT_DUE_DAYS,
    allowLateSubmission: settings?.allowLateSubmission ?? true,
    completedThisPeriod: 0,
    activity: [],
    branchId: dto.branchId,
    concurrencyToken: dto.concurrencyToken,
    settingsLoaded: settings !== undefined,
  };
}

export interface UseCategoriesQueryResult {
  categories: PreviewCategoryDetails[];
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * `GET /categories` — Authenticated, но результат зависит от branch-context (CAT-025/TEN-033):
 * конкретный выбранный филиал сужает список, «Все филиалы» отдаёт категории всей организации.
 * Query key branch-scoped (`branchScopedKey`) — `BranchProvider` уже умеет чистить такие ключи
 * при смене филиала (см. `features/branch-context/BranchContext.tsx`).
 */
export function useCategoriesQuery(): UseCategoriesQueryResult {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';

  const categoriesQuery = useQuery({
    queryKey: categoriesListQueryKey(organizationId, branchContext.selectedBranchId),
    queryFn: () => listCategories({ page: 1, pageSize: MAX_PAGE_SIZE }),
    enabled: user !== null,
  });

  // Нужен, чтобы вычислить leadName/leadUserId/mentorsCount — на Category таких полей нет
  // (см. `resolveLeadInfo`). Тот же query key, что у `useUsersQuery()` — TanStack Query
  // дедуплицирует одинаковый ключ, повторного сетевого запроса не будет.
  const usersQuery = useQuery({
    queryKey: usersListQueryKey(organizationId),
    queryFn: () => listUsers({ page: 1, pageSize: MAX_PAGE_SIZE }),
    enabled: user !== null,
  });

  const branchNameById = new Map<string, string>(
    branchContext.canOverrideBranch
      ? branchContext.availableBranches.map((branch) => [branch.id, branch.name])
      : branchContext.fixedBranch !== null
        ? [[branchContext.fixedBranch.id, branchContext.fixedBranch.name]]
        : [],
  );
  const resolveBranchName = (branchId: string): string | null => branchNameById.get(branchId) ?? null;

  const users = usersQuery.data?.items ?? [];
  const categories = (categoriesQuery.data?.items ?? []).map((dto) =>
    toCategoryDetails(dto, resolveLeadInfo(dto.id, users), resolveBranchName),
  );

  return {
    categories,
    isPending: categoriesQuery.isPending,
    isFetching: categoriesQuery.isFetching || usersQuery.isFetching,
    error: categoriesQuery.error,
    refetch: () => {
      void categoriesQuery.refetch();
      void usersQuery.refetch();
    },
  };
}

export interface UseCategoriesForBranchResult {
  categories: CategoryDto[];
  isPending: boolean;
  error: unknown;
}

/**
 * Категории конкретного филиала независимо от текущего глобального branch-context — нужен формам,
 * где Organization Admin выбирает целевой филиал ЛОКАЛЬНО (создание пользователя/направления,
 * смена роли, перевод) и категория должна резолвиться именно под этот выбор, а не под то, что
 * сейчас выбрано в шапке (см. `listCategories()`'s `branchId` override в `api/admin/categories.ts`).
 *
 * `sendBranchOverride` — `true` только для Organization Admin: заголовок `X-MTF-Branch-Id`
 * разрешён исключительно этой роли (Branch Admin получил бы 403 `SCOPE_OVERRIDE_FORBIDDEN`).
 * Для Branch Admin `branchId` не передаётся вовсе — их собственный филиал и так резолвится через
 * claims, а выбор в форме всегда равен их единственному доступному филиалу.
 */
export function useCategoriesForBranch(branchId: string | null, sendBranchOverride: boolean): UseCategoriesForBranchResult {
  const overrideId = sendBranchOverride ? branchId : null;
  const query = useQuery({
    queryKey: ['admin-categories', 'for-branch', sendBranchOverride ? (branchId ?? 'none') : 'own'],
    queryFn: () => listCategories({ page: 1, pageSize: MAX_PAGE_SIZE, isActive: true }, overrideId ?? undefined),
    enabled: !sendBranchOverride || (branchId !== null && branchId.length > 0),
  });

  return { categories: query.data?.items ?? [], isPending: query.isPending, error: query.error };
}

export interface UseCategorySettingsQueryResult {
  settings: CategorySettingsDto | undefined;
  isPending: boolean;
  error: unknown;
}

/**
 * `GET /categories/{id}/settings` — отдельный ресурс со своим `concurrencyToken`, не входит в
 * `GET /categories` (см. `CategoryDto`/`CategorySettingsDto` в промпте интеграции). Загружается
 * по требованию — вкладкой «Настройки» в Drawer и формой редактирования, а не для всего списка
 * (иначе N+1 запросов на каждую карточку страницы `/admin/categories`).
 */
export function useCategorySettingsQuery(categoryId: string | null): UseCategorySettingsQueryResult {
  const query = useQuery({
    queryKey: ['admin-categories', 'settings', categoryId ?? 'none'],
    queryFn: () => getCategorySettings(categoryId as string),
    enabled: categoryId !== null,
  });

  return { settings: query.data, isPending: categoryId !== null && query.isPending, error: query.error };
}

import { useQuery } from '@tanstack/react-query';

import { listUsers } from '../../api/admin/users';
import type { UserDto } from '../../api/admin/users';
import { listCategories } from '../../api/admin/categories';
import type { CategoryDto } from '../../api/admin/categories';
import { useAuth } from '../../auth/useAuth';
import { branchScopedKey } from '../branch-context/queryKeys';
import { useBranchContext } from '../branch-context/useBranchContext';
import type { PreviewUserRole, PreviewUserStatus } from '../../mocks/ui-preview/users.preview';
import type { PreviewUserDetails } from './userPresentation';

/** `pageSize` максимальный (backend `PaginationLimits.MaxPageSize = 100`) — тот же принцип, что у
 * `listBranchesDetailed()`: пагинации в UI пока нет (см. `docs/PHASE_0_INTEGRATION_AUDIT.md` §7.4/§5),
 * при реальном превышении 100 пользователей потребуется добавить пагинацию отдельно. */
const MAX_PAGE_SIZE = 100;

export function usersListQueryKey(organizationId: string): readonly unknown[] {
  return ['admin-users', 'list', organizationId] as const;
}

/**
 * `Role`+`AdminScope` (backend, `Frontend/src/api/generated/auth-api.ts`) ↔ `PreviewUserRole`
 * (плоская UI-модель, `mocks/ui-preview/users.preview.ts`) — рефакторинг, зафиксированный как
 * необходимый в `docs/phase-1-owner-organization-admin/Phase_1_Product_Extensions_and_Open_Questions.md`
 * §3.2. Маппинг живёт на границе API, не переписывая всю презентационную модель.
 */
export function toPreviewRole(role: string, adminScope: string | null): PreviewUserRole {
  if (role === 'Admin') return adminScope === 'Organization' ? 'OrgAdmin' : 'BranchAdmin';
  if (role === 'Lead') return 'Lead';
  return 'Mentor';
}

/** Обратное направление — для тела `ChangeRoleRequest`/`CreateUserRequest`. `'OrgAdmin'` сюда никогда не передаётся (форма Create/ChangeRole его не предлагает, раздел §3.0 того же документа). */
export function fromAssignableRole(role: Exclude<PreviewUserRole, 'OrgAdmin'>): { role: string; adminScope: string | null } {
  if (role === 'BranchAdmin') return { role: 'Admin', adminScope: 'Branch' };
  if (role === 'Lead') return { role: 'Lead', adminScope: null };
  return { role: 'Mentor', adminScope: null };
}

function toStatus(dto: UserDto): PreviewUserStatus {
  if (!dto.isActive) return 'Deactivated';
  if (!dto.hasPassword) return 'Invited';
  return 'Active';
  // 'Locked' недостижим из реальных данных — backend не хранит отдельное состояние
  // «заблокирован администратором», см. docs §3.3 (Block/Unblock — Product Decision Required).
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Формат `ДД.ММ.ГГГГ, ЧЧ:ММ` — тот же, что уже парсит `formatLastLogin()` в `UsersPage.tsx`. */
function formatDateTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDateLabel(iso)}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export interface BranchNameLookup {
  (branchId: string): string | null;
}

/**
 * Собирает `UserDto` -> `PreviewUserDetails`. Экспортируется отдельно — `useUserActions.ts`
 * переиспользует для маппинга ответа мутаций (тот же приём, что `toBranchDetails` у Branches).
 */
export function toUserDetails(
  dto: UserDto,
  resolveBranchName: BranchNameLookup,
  categoryNameById: ReadonlyMap<string, string>,
): PreviewUserDetails {
  const role = toPreviewRole(dto.role, dto.adminScope);
  const status = toStatus(dto);
  const branchName = dto.branchId !== null ? (dto.branch?.name ?? resolveBranchName(dto.branchId) ?? '—') : '';
  // Категория резолвится по списку категорий, видимому вызывающему (см. комментарий в useUsersQuery
  // ниже про branch-scoped список категорий) — если категория вне текущего scope, имя не резолвится
  // и показывается как «Не назначено», что технически неточно (пользователь категорию имеет, просто
  // сервер не прислал её в этом branch-scoped ответе) — зафиксировано в docs/INTEGRATION_UI_ISSUES.md.
  const categoryName = dto.categoryId !== null ? (categoryNameById.get(dto.categoryId) ?? null) : null;
  const lastLoginLabel = dto.lastLoginAt !== null ? formatDateTimeLabel(dto.lastLoginAt) : 'Ещё не входил';
  const createdLabel = formatDateLabel(dto.createdAt);

  return {
    id: dto.id,
    fullName: dto.fullName,
    email: dto.email,
    role,
    branchName,
    categoryName,
    status,
    lastLoginLabel,
    createdLabel,
    // TODO(docs §3.5): `notificationLanguage` не существует в модели User backend — честный
    // плейсхолдер, поле остаётся в форме редактирования, но никогда не уходит в запрос.
    notificationLanguage: 'ru',
    invitedAtLabel: createdLabel,
    passwordSet: dto.hasPassword,
    // Backend не хранит дату последней смены пароля отдельно от факта её наличия.
    lastPasswordChangeLabel: null,
    activeSessions: 0,
    lockReason: null,
    lockComment: null,
    deactivatedAtLabel: null,
    // Assignments-домен вне скоупа этой интеграции — честный 0, не выдуманное число.
    activeAssignmentsCount: 0,
    activity: [],
    branchId: dto.branchId,
    categoryId: dto.categoryId,
    concurrencyToken: dto.concurrencyToken,
  };
}

export interface UseUsersQueryResult {
  users: PreviewUserDetails[];
  categories: CategoryDto[];
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * `GET /users` — LeadOrAdmin, но список УЖЕ отфильтрован сервером под scope вызывающего:
 * Organization Admin видит всех пользователей организации (`UserService.ApplyVisibility`
 * не сужает по X-MTF-Branch-Id для этой роли), Branch Admin — только пользователей своего
 * филиала. Поэтому, в отличие от Branches, здесь достаточно одного query — постранично не
 * зависящего от глобального branch-context селектора (см. коммент внутри `UserService.cs`).
 */
export function useUsersQuery(): UseUsersQueryResult {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';

  const usersQuery = useQuery({
    queryKey: usersListQueryKey(organizationId),
    queryFn: () => listUsers({ page: 1, pageSize: MAX_PAGE_SIZE }),
    enabled: user !== null,
  });

  // Нужен для резолва categoryName -> id (у UserDto только `categoryId`, без embedded имени).
  // `GET /categories` зависит от текущего branch-context (см. `useCategoriesQuery.ts`) — если
  // Organization Admin сузил контекст до одного филиала, пользователи ДРУГИХ филиалов не найдут
  // свою категорию в этом списке (см. комментарий в `toUserDetails`).
  // Тот же ключ, что строит `categoriesListQueryKey()` в `useCategoriesQuery.ts` (не импортируется
  // напрямую — обратный импорт создал бы циклическую зависимость между двумя query-хуками), поэтому
  // при совпадении организации/выбранного филиала TanStack Query дедуплицирует запрос.
  const categoriesQuery = useQuery({
    queryKey: branchScopedKey('admin-categories', organizationId, branchContext.selectedBranchId, 'list'),
    queryFn: () => listCategories({ page: 1, pageSize: MAX_PAGE_SIZE }),
    enabled: user !== null,
  });

  const categoryNameById = new Map<string, string>((categoriesQuery.data?.items ?? []).map((category) => [category.id, category.name]));

  const branchNameById = new Map<string, string>(
    branchContext.canOverrideBranch
      ? branchContext.availableBranches.map((branch) => [branch.id, branch.name])
      : branchContext.fixedBranch !== null
        ? [[branchContext.fixedBranch.id, branchContext.fixedBranch.name]]
        : [],
  );
  const resolveBranchName: BranchNameLookup = (branchId) => branchNameById.get(branchId) ?? null;

  const users = (usersQuery.data?.items ?? []).map((dto) => toUserDetails(dto, resolveBranchName, categoryNameById));

  return {
    users,
    categories: categoriesQuery.data?.items ?? [],
    isPending: usersQuery.isPending,
    isFetching: usersQuery.isFetching || categoriesQuery.isFetching,
    error: usersQuery.error,
    refetch: () => {
      void usersQuery.refetch();
      void categoriesQuery.refetch();
    },
  };
}

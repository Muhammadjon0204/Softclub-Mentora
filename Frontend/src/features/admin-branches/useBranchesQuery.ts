import { useQuery } from '@tanstack/react-query';

import { getBranch, listBranchesDetailed } from '../../api/admin/branches';
import type { BranchDto, BranchSummaryDto } from '../../api/admin/branches';
import { useAuth } from '../../auth/useAuth';
import type { PreviewBranchDetails } from './branchPresentation';

function isFullBranchDto(dto: BranchDto | BranchSummaryDto): dto is BranchDto {
  return 'concurrencyToken' in dto;
}

function formatCreatedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Backend `BranchDto`/`BranchSummaryDto` не содержат `city`/`email`/`phone`,
 * количество категорий/менторов/активных заданий, health-индекс или
 * администратора филиала — этих доменов (Categories/Assignments/Users) в
 * интеграции ещё нет (см. `docs/phase-1-owner-organization-admin/
 * Phase_1_Product_Extensions_and_Open_Questions.md` §1.1/§1.2 — тот же
 * продуктовый пробел, что и у форм создания/редактирования филиала).
 * Секции Drawer, которым эти поля нужны (`BranchMetricsSection`,
 * `BranchAdminSection`, `BranchActivitySection`), сохранены как есть и
 * получают честные плейсхолдеры (0 / null / пустой список) вместо
 * выдуманных чисел — они read-only показывают "нет данных", а не врут.
 */
/** Экспортируется отдельно — `useBranchActions.ts` переиспользует для маппинга ответа мутаций. */
export function toBranchDetails(dto: BranchDto | BranchSummaryDto): PreviewBranchDetails {
  const shared = {
    id: dto.id,
    name: dto.name,
    code: dto.code,
    isHeadOffice: dto.isHeadOffice,
    adminName: null,
    categoriesCount: 0,
    mentorsCount: 0,
    activeAssignments: 0,
    healthPct: 0,
    // Backend не хранит "город" отдельно от адреса — используем имя филиала,
    // как и прежний preview enrichBranch() делал для сид-данных без city.
    city: dto.name,
    email: null,
    phone: null,
    adminUserId: null,
    activity: [] as PreviewBranchDetails['activity'],
  };

  if (isFullBranchDto(dto)) {
    return {
      ...shared,
      address: dto.address ?? '',
      isActive: dto.isActive,
      timezone: dto.timeZoneId,
      createdLabel: formatCreatedLabel(dto.createdAt),
      concurrencyToken: dto.concurrencyToken,
    };
  }

  // BranchSummaryDto (Lead/Mentor/Branch Admin о своём филиале) — ни адреса,
  // ни таймзоны, ни isActive/createdAt backend не отдаёт на этом уровне
  // авторизации. Полноценный профиль виден только Organization Admin.
  return {
    ...shared,
    address: '',
    isActive: true,
    timezone: '',
    createdLabel: '—',
    concurrencyToken: undefined,
  };
}

export interface UseBranchesQueryResult {
  branches: PreviewBranchDetails[];
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Organization Admin получает полный список (`GET /branches`, 403 для всех
 * остальных ролей). Branch Admin/Lead/Mentor видят ровно свой филиал через
 * `GET /branches/{id}` (доступно любому Authenticated для собственного
 * филиала) — это не одна и та же query, разные роли физически не могут
 * ходить по одному и тому же эндпоинту без 403.
 */
export function useBranchesQuery(): UseBranchesQueryResult {
  const { user } = useAuth();
  const isOrgAdmin = user?.adminScope === 'Organization';
  const ownBranchId = user?.branch?.id ?? null;
  const organizationId = user?.organization.id ?? 'anonymous';

  const listQuery = useQuery({
    queryKey: ['admin-branches', 'list', organizationId],
    queryFn: listBranchesDetailed,
    enabled: user !== null && isOrgAdmin,
  });

  const ownQuery = useQuery({
    queryKey: ['admin-branches', 'own', ownBranchId ?? 'none'],
    queryFn: () => getBranch(ownBranchId as string),
    enabled: user !== null && !isOrgAdmin && ownBranchId !== null,
  });

  if (isOrgAdmin) {
    return {
      branches: (listQuery.data ?? []).map(toBranchDetails),
      isPending: listQuery.isPending,
      isFetching: listQuery.isFetching,
      error: listQuery.error,
      refetch: () => { void listQuery.refetch(); },
    };
  }

  return {
    branches: ownQuery.data !== undefined ? [toBranchDetails(ownQuery.data)] : [],
    isPending: ownBranchId !== null && ownQuery.isPending,
    isFetching: ownQuery.isFetching,
    error: ownQuery.error,
    refetch: () => { void ownQuery.refetch(); },
  };
}

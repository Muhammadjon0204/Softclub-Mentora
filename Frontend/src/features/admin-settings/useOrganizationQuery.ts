import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { getOrganization, type OrganizationDto } from '../../api/admin/organization';
import { useAuth } from '../../auth/useAuth';

export function organizationQueryKey(organizationId: string): readonly [string, string] {
  return ['organization', organizationId] as const;
}

/**
 * Вкладка «Организация» в /admin/settings видна только Organization Admin
 * (`ORG_ADMIN_TABS` в `SettingsPage.tsx`) — только для этой роли включаем
 * запрос: остальным ролям GET /organization отдаёт урезанный `OrganizationSummaryDto`,
 * не совпадающий с типом `OrganizationDto` этого клиента.
 */
export function useOrganizationQuery(): UseQueryResult<OrganizationDto> {
  const { user } = useAuth();
  const isOrgAdmin = user?.adminScope === 'Organization';
  const organizationId = user?.organization.id ?? 'anonymous';

  return useQuery({
    queryKey: organizationQueryKey(organizationId),
    queryFn: getOrganization,
    enabled: user !== null && isOrgAdmin,
    staleTime: 60 * 1000,
  });
}

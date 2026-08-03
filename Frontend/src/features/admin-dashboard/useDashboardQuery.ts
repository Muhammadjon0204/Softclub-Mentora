import { useQuery } from '@tanstack/react-query';

import { getDashboard } from '../../api/admin/dashboard';
import { useAuth } from '../../auth/useAuth';
import { branchScopedKey } from '../branch-context/queryKeys';
import { useBranchContext } from '../branch-context/useBranchContext';

/**
 * Ключ запроса включает `organizationId` и arendный scope (ТЗ FE-036): при
 * смене филиала меняется сам ключ, поэтому TanStack Query никогда не покажет
 * данные предыдущего филиала под видом новых — под новым ключом попросту
 * нет кэша, и хук сразу переходит в `isPending`.
 */
export function useDashboardQuery() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';

  return useQuery({
    queryKey: branchScopedKey('admin-dashboard', organizationId, selectedBranchId),
    queryFn: getDashboard,
    enabled: user !== null,
    staleTime: 30 * 1000,
  });
}

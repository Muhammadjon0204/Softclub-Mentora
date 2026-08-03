import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getDashboard } from '../../api/admin/dashboard';
import { useAuth } from '../../auth/useAuth';
import { branchScopedKey } from '../branch-context/queryKeys';
import { useBranchContext } from '../branch-context/useBranchContext';
import { parseDashboardPeriod, type DashboardPeriod } from './dashboardPeriod';

/**
 * Период — единственный источник истины: URL `?period=`, без localStorage
 * (раздел 4 полироли). Ключ запроса включает organization + branch + period
 * (раздел FE-036 + раздел 4): смена любого из трёх физически не может
 * показать данные другого scope под видом текущего — под новым ключом просто
 * нет кэша, и `keepPreviousData` мягко держит старые данные ровно до ответа.
 */
export function useDashboardQuery() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parseDashboardPeriod(searchParams.get('period'));

  const setPeriod = useCallback(
    (next: DashboardPeriod) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('period', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const query = useQuery({
    queryKey: branchScopedKey('admin-dashboard', organizationId, selectedBranchId, period),
    queryFn: () => getDashboard(period),
    enabled: user !== null,
    staleTime: 30 * 1000,
    // Смена периода/филиала не должна резко чистить экран — старые данные остаются
    // видны (мягкий isFetching-индикатор), пока не придёт ответ под новым ключом.
    placeholderData: keepPreviousData,
  });

  return { ...query, period, setPeriod };
}

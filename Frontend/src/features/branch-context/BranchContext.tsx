import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { listBranches } from '../../api/admin/branches';
import { useAuth } from '../../auth/useAuth';
import { BranchContext, type BranchContextValue } from './branchContextDefinition';
import { BRANCH_SCOPED_TAG } from './queryKeys';
import { setBranchScopeState } from './branchScopeStore';

interface BranchProviderProps {
  children: ReactNode;
}

/**
 * Провайдер арендного контекста (ТЗ 2.2, раздел 24.7). НЕ является границей
 * безопасности: он решает только какой заголовок отправить, какие ключи кэша
 * использовать и что показать в интерфейсе. Backend обязан проверить scope
 * самостоятельно на каждый запрос — состояние этого провайдера ему не указ.
 */
export function BranchProvider({ children }: BranchProviderProps): JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOrgAdmin = user?.role === 'Admin' && user.adminScope === 'Organization';

  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);

  const branchesQuery = useQuery({
    queryKey: ['branches', user?.organization.id ?? 'anonymous'],
    queryFn: listBranches,
    enabled: isOrgAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Смена пользователя (повторный вход другим аккаунтом) обязана сбросить выбор —
  // иначе новый Organization Admin увидел бы филиал, выбранный в чужой сессии.
  useEffect(() => {
    setSelectedBranchIdState(null);
  }, [user?.id]);

  // Зеркалим состояние в module-singleton store: интерцептор axios читает его
  // синхронно на каждый запрос (см. branchHeaderInterceptor.ts).
  useEffect(() => {
    setBranchScopeState({
      selectedBranchId: isOrgAdmin ? selectedBranchId : (user?.branch?.id ?? null),
      canOverrideBranch: isOrgAdmin,
    });
  }, [isOrgAdmin, selectedBranchId, user?.branch?.id]);

  const purgeBranchScopedCache = useCallback((): void => {
    const predicate = (query: { queryKey: readonly unknown[] }): boolean =>
      query.queryKey.includes(BRANCH_SCOPED_TAG);
    void queryClient.cancelQueries({ predicate });
    queryClient.removeQueries({ predicate });
  }, [queryClient]);

  const setSelectedBranch = useCallback(
    (branchId: string | null): void => {
      // Branch Admin/Lead/Mentor не могут переключать контекст — no-op (ТЗ FE-034).
      if (!isOrgAdmin) return;
      if (branchId === selectedBranchId) return;
      purgeBranchScopedCache();
      setSelectedBranchIdState(branchId);
    },
    [isOrgAdmin, purgeBranchScopedCache, selectedBranchId],
  );

  const clearBranchContext = useCallback((): void => {
    setSelectedBranch(null);
  }, [setSelectedBranch]);

  const value = useMemo<BranchContextValue>(
    () => ({
      selectedBranchId: isOrgAdmin ? selectedBranchId : (user?.branch?.id ?? null),
      isAllBranches: isOrgAdmin && selectedBranchId === null,
      canOverrideBranch: isOrgAdmin,
      availableBranches: branchesQuery.data ?? [],
      isLoadingBranches: branchesQuery.isLoading,
      branchesError: branchesQuery.error,
      refetchBranches: () => {
        void branchesQuery.refetch();
      },
      fixedBranch: isOrgAdmin ? null : (user?.branch ?? null),
      setSelectedBranch,
      clearBranchContext,
    }),
    [
      isOrgAdmin,
      selectedBranchId,
      user?.branch,
      branchesQuery.data,
      branchesQuery.isLoading,
      branchesQuery.error,
      branchesQuery.refetch,
      setSelectedBranch,
      clearBranchContext,
    ],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

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

const BRANCH_STORAGE_KEY_PREFIX = 'mentora.branchContext.selectedBranchId.';

// Персистим только сам выбор (это UI-предпочтение, не граница безопасности —
// backend всё равно проверяет scope на каждый запрос), с ключом per-user,
// чтобы вход другим аккаунтом не унаследовал чужой выбор.
function readStoredBranchId(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(BRANCH_STORAGE_KEY_PREFIX + userId);
  } catch {
    return null;
  }
}

function writeStoredBranchId(userId: string | undefined, branchId: string | null): void {
  if (!userId) return;
  try {
    if (branchId === null) {
      window.localStorage.removeItem(BRANCH_STORAGE_KEY_PREFIX + userId);
    } else {
      window.localStorage.setItem(BRANCH_STORAGE_KEY_PREFIX + userId, branchId);
    }
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — просто не персистим.
  }
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

  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(() =>
    readStoredBranchId(user?.id),
  );

  const branchesQuery = useQuery({
    queryKey: ['branches', user?.organization.id ?? 'anonymous'],
    queryFn: listBranches,
    enabled: isOrgAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Смена пользователя (повторный вход другим аккаунтом, включая первичную
  // загрузку user из /auth/session) обязана восстановить выбор именно этого
  // пользователя — иначе новый Organization Admin увидел бы филиал, выбранный
  // в чужой сессии, а обновление страницы (F5) под тем же пользователем сбрасывало
  // бы выбор на «Все филиалы» вместо сохранённого.
  useEffect(() => {
    setSelectedBranchIdState(readStoredBranchId(user?.id));
  }, [user?.id]);

  // Если персистентный выбор указывает на филиал, который больше недоступен
  // (удалён/переименован из-под пользователя), откатываемся на «Все филиалы»
  // вместо того, чтобы держать «зависший» выбор.
  useEffect(() => {
    if (!isOrgAdmin || selectedBranchId === null || branchesQuery.data === undefined) return;
    const stillExists = branchesQuery.data.some((branch) => branch.id === selectedBranchId);
    if (!stillExists) {
      setSelectedBranchIdState(null);
      writeStoredBranchId(user?.id, null);
    }
  }, [isOrgAdmin, selectedBranchId, branchesQuery.data, user?.id]);

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
      writeStoredBranchId(user?.id, branchId);
    },
    [isOrgAdmin, purgeBranchScopedCache, selectedBranchId, user?.id],
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

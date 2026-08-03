/**
 * Общий тег branch-scoped запросов. Каждый ключ TanStack Query, зависящий
 * от выбранного филиала, обязан его содержать — так `BranchProvider` может
 * найти и вычистить ровно эти записи кэша при смене филиала (ТЗ FE-036, FE-037),
 * не трогая при этом `['auth', 'me']` и прочие не завязанные на Branch данные.
 */
export const BRANCH_SCOPED_TAG = 'branch-scoped' as const;

/** `selectedBranchId` -> стабильный сегмент ключа: `null` значит «Все филиалы». */
export function branchScopeSegment(selectedBranchId: string | null): string {
  return selectedBranchId ?? 'all';
}

export function branchScopedKey(
  domain: string,
  organizationId: string,
  selectedBranchId: string | null,
  ...rest: ReadonlyArray<string | number | null | undefined>
) {
  return [domain, BRANCH_SCOPED_TAG, organizationId, branchScopeSegment(selectedBranchId), ...rest] as const;
}

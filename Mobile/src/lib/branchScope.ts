import { useSyncExternalStore } from 'react';

/**
 * Which branch an organization administrator is looking at — the site's «Все филиалы» selector.
 * `null` means all of them. Everyone else is pinned to their own branch by the server and never
 * sends the header (the API refuses it from them).
 */
export interface BranchScope {
  id: string;
  name: string;
}

let scope: BranchScope | null = null;
let canOverride = false;
const listeners = new Set<() => void>();

export function setCanOverrideBranch(value: boolean): void {
  canOverride = value;
  if (!value) setBranchScope(null);
}

export function setBranchScope(next: BranchScope | null): void {
  if (scope?.id === next?.id) return;
  scope = next;
  listeners.forEach((listener) => listener());
}

/** The header for a request; `branchId` names the branch of the thing being changed. */
export function branchHeader(branchId?: string | null): Record<string, string> {
  if (!canOverride) return {};
  const id = branchId ?? scope?.id;
  return id ? { 'X-MTF-Branch-Id': id } : {};
}

export function useBranchScope(): BranchScope | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => scope,
    () => scope,
  );
}

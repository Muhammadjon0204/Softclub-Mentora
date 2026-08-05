import { useSyncExternalStore } from 'react';

/**
 * Organization в ТЗ имеет ровно одно изменяемое через `PUT /organization`
 * поле — `name` (ORG-004); `slug` неизменяем (ORG-020), `isActive` управляется
 * только provisioning-процессом (ORG-007). Хранить здесь что-то ещё было бы
 * расширением продуктовой области без основания в ТЗ.
 */
export interface OrganizationPreviewState {
  name: string;
  slug: string;
}

let state: OrganizationPreviewState = { name: 'SoftClub IT Academy', slug: 'softclub-academy' };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): OrganizationPreviewState {
  return state;
}

export function useOrganizationPreview(): OrganizationPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function updateOrganizationNamePreview(name: string): OrganizationPreviewState {
  state = { ...state, name: name.trim() };
  emit();
  return state;
}

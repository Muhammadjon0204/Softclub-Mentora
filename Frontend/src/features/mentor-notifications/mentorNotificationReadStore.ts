import { useSyncExternalStore } from 'react';

/**
 * Module-level стор прочитанных уведомлений — тот же приём
 * `useSyncExternalStore`, что у остальных preview-стеков Mentor-раздела.
 * Живёт только в памяти вкладки (раздел 27 задачи допускает это для
 * функциональности без backend-эндпоинта), но реально меняет состояние —
 * счётчик непрочитанных в sidebar и полужирность строк действительно
 * обновляются, а не просто гаснут визуально.
 */
let readIds = new Set<string>();
let seeded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): Set<string> {
  return readIds;
}

export function useMentorNotificationReadIds(): Set<string> {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function markNotificationRead(id: string): void {
  if (readIds.has(id)) return;
  readIds = new Set(readIds);
  readIds.add(id);
  emit();
}

export function markAllNotificationsRead(ids: string[]): void {
  const next = new Set(readIds);
  let changed = false;
  for (const id of ids) {
    if (!next.has(id)) {
      next.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  readIds = next;
  emit();
}

/** Однократный посев: уведомления старше `olderThanIds` на момент первой загрузки страницы стартуют прочитанными — иначе лента открывалась бы вся полужирной. Идемпотентно на весь срок жизни вкладки. */
export function seedReadStateOnce(olderThanIds: string[]): void {
  if (seeded) return;
  seeded = true;
  if (olderThanIds.length === 0) return;
  readIds = new Set([...readIds, ...olderThanIds]);
  emit();
}

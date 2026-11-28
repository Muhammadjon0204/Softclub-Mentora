/**
 * Команда, в которой человек сейчас работает, — module-singleton по образцу `tokenStore`: его читает
 * не только React, но и axios-интерцептор, который ставит заголовок `X-MTF-Team-Id`.
 *
 * `null` — «как в аккаунте»: основная команда или панель администратора, заголовок не нужен. Это не
 * граница доступа: сервер на каждом запросе сам проверяет, что человек состоит в названной команде.
 */
import { readPreference, writePreference } from '../lib/preferenceStorage';

export const TEAM_HEADER_NAME = 'X-MTF-Team-Id';

type Listener = () => void;

let activeTeamId: string | null = null;
const listeners = new Set<Listener>();

export function getActiveTeamId(): string | null {
  return activeTeamId;
}

export function setActiveTeamId(next: string | null): void {
  if (next === activeTeamId) return;
  activeTeamId = next;
  for (const listener of [...listeners]) listener();
}

export function subscribeActiveTeam(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const preferenceKey = (userId: string): string => `ravand.activeTeam.${userId}`;

/** Последний выбор этого человека в этом браузере, чтобы после перезагрузки остаться там же. */
export function rememberedTeamId(userId: string): string | null {
  return readPreference(preferenceKey(userId));
}

export function rememberTeamId(userId: string, teamId: string | null): void {
  writePreference(preferenceKey(userId), teamId);
}

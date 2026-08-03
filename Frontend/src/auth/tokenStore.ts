/**
 * Module singleton для access-токена.
 *
 * Токен существует ТОЛЬКО как переменная модуля. Запрещены localStorage,
 * sessionStorage, IndexedDB, cookie, URL и любой persisted-кэш React Query:
 * всё это доступно XSS и переживает вкладку.
 *
 * После перезагрузки страницы токена нет — это ожидаемое поведение,
 * сессия восстанавливается silent refresh'ем по HttpOnly-cookie.
 */

type AccessTokenListener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<AccessTokenListener>();

function notify(): void {
  for (const listener of [...listeners]) listener(accessToken);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
  notify();
}

export function clearAccessToken(): void {
  if (accessToken === null) return;
  accessToken = null;
  notify();
}

export function subscribe(listener: AccessTokenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const tokenStore = {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  subscribe,
};

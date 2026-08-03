/**
 * Эмуляция серверных cookie внутри MSW.
 *
 * Контракт, который реализует backend:
 *
 *   mtf_rt:   HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; host-only
 *   mtf_csrf: Secure; SameSite=Strict; Path=/; non-HttpOnly; host-only
 *
 * ЧЕСТНАЯ ОГОВОРКА: страница не может выдать сама себе настоящую HttpOnly-cookie —
 * ответ синтезируется тем же JS-контекстом, который её потом читал бы. Поэтому:
 *
 *   • `mtf_rt` вообще не попадает в `document.cookie`. Её значение живёт
 *     в переменной этого модуля, доступной только mock-хендлерам. Для кода
 *     приложения она физически недостижима — это строже, чем HttpOnly в браузере.
 *   • `mtf_csrf` — настоящая cookie в `document.cookie`, как и в production:
 *     она обязана быть читаемой из JS для double-submit.
 *
 * MSW НЕ обеспечивает криптографических гарантий. Он воспроизводит контракт,
 * который должен реализовать backend.
 */

const CSRF_COOKIE_NAME = 'mtf_csrf';

/** Ровно то, что в production лежало бы в HttpOnly-cookie `mtf_rt`. */
let refreshCookieValue: string | null = null;

export function setRefreshCookie(value: string): void {
  refreshCookieValue = value;
}

export function readRefreshCookie(): string | null {
  return refreshCookieValue;
}

export function clearRefreshCookie(): void {
  refreshCookieValue = null;
}

export function setCsrfCookie(value: string): void {
  if (typeof document === 'undefined') return;
  // Path=/ по контракту: с Path=/api/v1/auth страница /login не увидела бы cookie
  // в document.cookie и double-submit был бы невозможен.
  // Secure здесь не ставим — dev-сервер работает по http, в production его выдаёт backend.
  document.cookie = `${CSRF_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; SameSite=Strict`;
}

export function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;

  const prefix = `${CSRF_COOKIE_NAME}=`;
  const chunk = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  if (chunk === undefined) return null;
  return decodeURIComponent(chunk.slice(prefix.length));
}

export function clearCsrfCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CSRF_COOKIE_NAME}=; Path=/; SameSite=Strict; Max-Age=0`;
}

export function clearSessionCookies(): void {
  clearRefreshCookie();
  clearCsrfCookie();
}

/** Заголовок для ответа: показывает, что именно выставил бы backend. */
export const EXPIRED_CSRF_SET_COOKIE = `${CSRF_COOKIE_NAME}=; Path=/; Secure; SameSite=Strict; Max-Age=0`;

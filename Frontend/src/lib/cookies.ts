/**
 * Чтение обычных (не HttpOnly) cookie.
 *
 * Приложение читает отсюда РОВНО одну cookie — `mtf_csrf`
 * (`Secure; SameSite=Strict; Path=/; non-HttpOnly; host-only`), потому что её
 * значение обязано попасть в заголовок `X-CSRF-Token` (double submit). `Path=/`
 * обязателен: `document.cookie` видит cookie только если текущий путь документа
 * матчится с её `Path` — уже её на `/api/v1/auth` делало `readCsrfToken()` всегда
 * `null` на любой реальной странице SPA (см. `AuthCookieManager.CsrfCookiePath`).
 *
 * Refresh-cookie — HttpOnly с `Path=/api/v1/auth`, читать её из JS невозможно
 * и не нужно. Её имени в коде приложения нет вообще: оно живёт только внутри mock-слоя.
 */

export const CSRF_COOKIE_NAME = 'mtf_csrf';

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const prefix = `${encodeURIComponent(name)}=`;
  const chunk = document.cookie.split('; ').find((part) => part.startsWith(prefix));

  if (chunk === undefined) return null;
  return decodeURIComponent(chunk.slice(prefix.length));
}

export function readCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE_NAME);
}

/**
 * Хранилище UI-предпочтений (выбранный филиал и подобное) в `localStorage`.
 *
 * Единственное место, где фронтенд трогает `localStorage`: ESLint запрещает его везде, чтобы
 * туда не попали токены и другие auth-данные, и разрешает только этот модуль. Сюда — только
 * то, что не является границей безопасности: backend всё равно проверяет доступ на каждый запрос.
 * Недоступное хранилище (приватный режим, запрет сайта) молча игнорируется.
 */
export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Хранилище недоступно — просто не запоминаем.
  }
}

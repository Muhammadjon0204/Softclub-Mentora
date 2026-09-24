import axios, { type InternalAxiosRequestConfig } from 'axios';

import { authEvents, notifySessionEnded } from '../auth/authEvents';
import { clearAccessToken, getAccessToken } from '../auth/tokenStore';
import { createCorrelationId } from '../lib/correlationId';
import { AUTH_ERROR_CODE, getProblemCode, type AuthErrorCode } from './problemDetails';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Запрос уже повторяли после успешного refresh. Второй раз — только logout. */
    _retried?: boolean;
    /** Не пытаться чинить 401 этого запроса через refresh. */
    _skipAuthRefresh?: boolean;
  }
}

/**
 * Клиент для защищённых эндпоинтов: `/auth/me`, `/auth/change-password`
 * и всего будущего API.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token !== null) config.headers.set('Authorization', `Bearer ${token}`);
  config.headers.set('X-Correlation-Id', createCorrelationId());
  return config;
});

/* ------------------------------------------------------------------ */
/* Инъекция refresh-раннера                                            */
/* ------------------------------------------------------------------ */

type RefreshRunner = () => Promise<string>;

let refreshRunner: RefreshRunner | null = null;

/**
 * `refreshCoordinator` регистрирует себя здесь. Инъекция вместо прямого импорта —
 * чтобы `client.ts` не зависел от `auth/`, а `auth/` мог зависеть от `client.ts`.
 */
export function setRefreshRunner(runner: RefreshRunner | null): void {
  refreshRunner = runner;
}

/** Коды, при которых имеет смысл пробовать refresh. Все остальные 401 — окончательные. */
const REFRESHABLE_CODES: ReadonlySet<AuthErrorCode> = new Set<AuthErrorCode>([
  AUTH_ERROR_CODE.TOKEN_EXPIRED,
  AUTH_ERROR_CODE.TOKEN_VERSION_MISMATCH,
]);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.config === undefined) throw error;

    const config = error.config;
    const status = error.response?.status;
    const code = getProblemCode(error);

    // CSRF-провал на любом защищённом запросе (не только /auth/refresh) — например,
    // ключи DataProtection перегенерировались при перезапуске API, и старая cookie
    // `mtf_csrf` больше не валидна. Повторами это не чинится, нужен свежий логин —
    // раньше такой ответ просто прокидывался наверх как обычная ошибка, и страница
    // показывала общее «не удалось загрузить данные» вместо редиректа на /login.
    if (status === 403 && code === AUTH_ERROR_CODE.CSRF_VALIDATION_FAILED) {
      clearAccessToken();
      notifySessionEnded(error);
      throw error;
    }

    if (status !== 401) throw error;
    if (config._skipAuthRefresh === true) throw error;

    if (code === null || !REFRESHABLE_CODES.has(code)) {
      // «Финальные» 401 (UNAUTHORIZED, SECURITY_TOKEN_INVALID, USER_DEACTIVATED, код
      // отсутствует...) — retry их не чинит, нужен новый вход. Раньше это тоже просто
      // прокидывалось наверх без очистки сессии и редиректа (тот же симптом, что выше).
      clearAccessToken();
      authEvents.emit('sessionExpired', { reason: 'session-expired' });
      throw error;
    }

    // Повторный 401 уже после успешного refresh — дальше крутиться бессмысленно.
    if (config._retried === true) {
      clearAccessToken();
      authEvents.emit('sessionExpired', { reason: 'session-expired' });
      throw error;
    }

    if (refreshRunner === null) {
      clearAccessToken();
      authEvents.emit('sessionExpired', { reason: 'session-expired' });
      throw error;
    }

    try {
      await refreshRunner();
    } catch (refreshError: unknown) {
      // REFRESH_TOKEN_INVALID / REUSE / CSRF — разные баннеры на /login.
      notifySessionEnded(refreshError);
      throw error;
    }

    config._retried = true;
    // Authorization подставит request-интерцептор уже с новым токеном.
    return apiClient.request(config);
  },
);

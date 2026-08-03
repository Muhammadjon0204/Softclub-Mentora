import axios, { type InternalAxiosRequestConfig } from 'axios';

import { createCorrelationId } from '../lib/correlationId';
import { readCsrfToken } from '../lib/cookies';

/**
 * Клиент для эндпоинтов, которым не нужен Bearer-токен:
 * login, refresh, logout, forgot/reset/set-password.
 *
 * Принципиально БЕЗ response-интерцептора с авто-refresh — иначе провал refresh
 * попытался бы починить себя тем же refresh и получился бы бесконечный цикл.
 */

const CSRF_PROTECTED_PATHS = ['/api/v1/auth/refresh', '/api/v1/auth/logout'];

export const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  // Без этого HttpOnly refresh-cookie не уедет на сервер.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

publicClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set('X-Correlation-Id', createCorrelationId());

  const path = config.url ?? '';
  if (CSRF_PROTECTED_PATHS.some((protectedPath) => path.endsWith(protectedPath))) {
    const csrf = readCsrfToken();
    if (csrf !== null) config.headers.set('X-CSRF-Token', csrf);
  }

  return config;
});

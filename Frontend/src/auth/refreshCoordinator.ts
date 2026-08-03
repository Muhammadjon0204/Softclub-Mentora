import { AUTH_ENDPOINTS, type RefreshResponse } from '../api/auth';
import { setRefreshRunner } from '../api/client';
import { publicClient } from '../api/publicClient';
import { clearAccessToken, setAccessToken } from './tokenStore';

/**
 * Single-flight ротация access-токена.
 *
 * Сколько бы параллельных запросов ни получили `TOKEN_EXPIRED`, к серверу уходит
 * ровно один `POST /api/v1/auth/refresh`; остальные ждут тот же промис.
 */

let refreshPromise: Promise<string> | null = null;

async function runRefresh(): Promise<string> {
  try {
    const { data } = await publicClient.post<RefreshResponse>(AUTH_ENDPOINTS.refresh, null, {
      // Страховка: даже если кто-то повесит интерцептор на publicClient,
      // 401 самого refresh не должен уйти в новый refresh.
      _skipAuthRefresh: true,
    });
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch (error: unknown) {
    // Токен в памяти больше не валиден ни при одном из исходов.
    clearAccessToken();
    throw error;
  }
}

export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= runRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/** Только для тестов: снять «залипший» промис между кейсами. */
export function resetRefreshCoordinator(): void {
  refreshPromise = null;
}

// Регистрируем раннер в apiClient. Импорт этого модуля из AuthProvider делает
// установку детерминированной — никакой магии порядка импортов.
setRefreshRunner(refreshAccessToken);

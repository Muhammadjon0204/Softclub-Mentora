import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AUTH_ENDPOINTS, authApi } from '../api/auth';
import { apiClient } from '../api/client';
import type { ApiProblemDetails } from '../api/problemDetails';
import { publicClient } from '../api/publicClient';
import { authEvents, type SessionEndReason } from '../auth/authEvents';
import { refreshAccessToken } from '../auth/refreshCoordinator';
import { getAccessToken, setAccessToken } from '../auth/tokenStore';
import { clearCsrfCookie, readRefreshCookie, setRefreshCookie } from '../mocks/cookies';
import { server } from '../mocks/server';
import { expireAllAccessTokens } from '../mocks/tokens';
import { DEMO_PASSWORD, TEST_ACCOUNTS } from './utils';

function countRefreshCalls(): { get: () => number } {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.url.includes('/api/v1/auth/refresh')) count += 1;
  });
  return { get: () => count };
}

async function signIn(email: string = TEST_ACCOUNTS.admin): Promise<void> {
  const result = await authApi.login({ email, password: DEMO_PASSWORD });
  setAccessToken(result.accessToken);
}

const tokenExpiredProblem: ApiProblemDetails = {
  type: 'https://mentortaskflow.example/problems/token-expired',
  title: 'Access token expired',
  status: 401,
  code: 'TOKEN_EXPIRED',
  detail: 'Access-токен истёк',
  instance: '/api/v1/auth/me',
  traceId: 'trace-test',
  errors: {},
};

describe('Single-flight refresh', () => {
  // 12
  it('пять параллельных 401 TOKEN_EXPIRED порождают ровно один refresh', async () => {
    await signIn();
    const refreshCalls = countRefreshCalls();

    expireAllAccessTokens();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => apiClient.get(AUTH_ENDPOINTS.me)),
    );

    expect(refreshCalls.get()).toBe(1);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
  });

  // 13
  it('повторный 401 после успешного refresh не запускает второй refresh', async () => {
    await signIn();
    const refreshCalls = countRefreshCalls();

    // /me отвечает TOKEN_EXPIRED всегда — даже с новым токеном.
    server.use(
      http.get('*/api/v1/auth/me', () =>
        HttpResponse.json(tokenExpiredProblem, {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );

    let expiredReason: SessionEndReason | null = null;
    const unsubscribe = authEvents.on('sessionExpired', ({ reason }) => {
      expiredReason = reason;
    });

    await expect(apiClient.get(AUTH_ENDPOINTS.me)).rejects.toBeDefined();
    unsubscribe();

    expect(refreshCalls.get()).toBe(1);
    expect(expiredReason).toBe('session-expired');
    expect(getAccessToken()).toBeNull();
  });

  // 14
  it('повторное использование refresh-токена немедленно завершает сессию', async () => {
    await signIn(TEST_ACCOUNTS.reuse);

    const rotatedAwayToken = readRefreshCookie();
    expect(rotatedAwayToken).not.toBeNull();

    // Штатная ротация: старый токен становится «использованным».
    await refreshAccessToken();

    // Кто-то предъявляет перехваченную копию старого токена.
    setRefreshCookie(rotatedAwayToken as string);
    expireAllAccessTokens();

    let reuseDetected = false;
    const unsubscribe = authEvents.on('tokenReuseDetected', () => {
      reuseDetected = true;
    });

    await expect(apiClient.get(AUTH_ENDPOINTS.me)).rejects.toBeDefined();
    unsubscribe();

    expect(reuseDetected).toBe(true);
    expect(getAccessToken()).toBeNull();
  });

  // 15
  it('несовпадение CSRF даёт 403 и переводит клиента в logout-состояние', async () => {
    await signIn();

    // Cookie mtf_csrf пропала — клиенту нечего положить в X-CSRF-Token.
    clearCsrfCookie();

    await expect(publicClient.post(AUTH_ENDPOINTS.refresh, null)).rejects.toMatchObject({
      response: { status: 403 },
    });

    expireAllAccessTokens();

    let expiredReason: SessionEndReason | null = null;
    const unsubscribe = authEvents.on('sessionExpired', ({ reason }) => {
      expiredReason = reason;
    });

    await expect(apiClient.get(AUTH_ENDPOINTS.me)).rejects.toBeDefined();
    unsubscribe();

    expect(expiredReason).toBe('csrf-failed');
    expect(getAccessToken()).toBeNull();
  });

  it('401 INVALID_CREDENTIALS не приводит к refresh', async () => {
    const refreshCalls = countRefreshCalls();

    await expect(
      authApi.login({ email: TEST_ACCOUNTS.admin, password: 'WrongPassword123' }),
    ).rejects.toBeDefined();

    expect(refreshCalls.get()).toBe(0);
  });
});

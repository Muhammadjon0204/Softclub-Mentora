import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { authApi } from '../api/auth';
import { clearAccessToken, getAccessToken } from '../auth/tokenStore';
import { clearRefreshCookie, readRefreshCookie } from '../mocks/cookies';
import { resetDb } from '../mocks/db';
import { persistMockServerState, restoreMockServerState } from '../mocks/persistence';
import { server } from '../mocks/server';
import { DEMO_PASSWORD, TEST_ACCOUNTS, renderApp, trackRequests } from './utils';

function countRequests(requests: string[], fragment: string): number {
  return requests.filter((entry) => entry.includes(fragment)).length;
}

/**
 * Собственный cookie-store MSW. Это инфраструктура библиотеки моков, а не наш код:
 * в него попадают только заголовки `Set-Cookie` из ответов (у нас — гашение
 * `mtf_csrf` с `Max-Age=0`). Ни токенов, ни `mtf_rt` там нет и быть не может,
 * а в production-сборке MSW отсутствует целиком.
 */
const MSW_COOKIE_STORE_KEY = '__msw-cookie-store__';

function storageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

/** Всё, что лежит в хранилище, одной строкой. */
function dumpStorage(storage: Storage): string {
  return storageKeys(storage)
    .map((key) => `${key}=${storage.getItem(key) ?? ''}`)
    .join(';');
}

/** Ни один браузерный storage не содержит access-токенов, кроме инфраструктуры MSW. */
function expectNoTokensInBrowserStorage(...tokens: (string | null)[]): void {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const dump = dumpStorage(storage);
    for (const token of tokens) {
      if (token !== null && token.length > 0) expect(dump).not.toContain(token);
    }
  }

  expect(storageKeys(window.localStorage).filter((key) => key !== MSW_COOKIE_STORE_KEY)).toEqual(
    [],
  );
}

async function loginThroughUi(user: ReturnType<typeof renderApp>['user']): Promise<void> {
  await user.type(await screen.findByLabelText('Email'), TEST_ACCOUNTS.admin);
  await user.type(screen.getByLabelText('Пароль'), DEMO_PASSWORD);
  await user.click(screen.getByRole('button', { name: /войти/i }));

  await waitFor(() => {
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/dashboard');
  });
}

describe('Жизненный цикл сессии', () => {
  // 9
  it('access-токен не попадает ни в localStorage, ни в sessionStorage', async () => {
    const { user } = renderApp('/login');
    await loginThroughUi(user);

    const token = getAccessToken();
    expect(token).not.toBeNull();

    expectNoTokensInBrowserStorage(token);
    expect(window.sessionStorage.length).toBe(0);
    // И в cookie тоже: mtf_csrf — единственная, что видна из JS.
    expect(document.cookie).not.toContain(token ?? 'unreachable');
    expect(document.cookie).not.toContain('mtf_rt');
  });

  // 10
  it('после перезагрузки bootstrap проходит цепочку refresh -> me -> authenticated', async () => {
    // Сессия уже существует на «сервере», но access-токена в памяти нет — как после F5.
    await authApi.login({ email: TEST_ACCOUNTS.lead, password: DEMO_PASSWORD });
    clearAccessToken();

    const requests = trackRequests(server);
    renderApp('/lead/dashboard');

    expect(await screen.findByText('Далер Сафаров')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/lead/dashboard');
    expect(getAccessToken()).not.toBeNull();

    const refreshIndex = requests.findIndex((entry) => entry.includes('/auth/refresh'));
    const meIndex = requests.findIndex((entry) => entry.includes('/auth/me'));
    expect(refreshIndex).toBeGreaterThanOrEqual(0);
    expect(meIndex).toBeGreaterThan(refreshIndex);
  });

  // 11
  it('невалидный refresh переводит приложение в anonymous', async () => {
    renderApp('/admin/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
    expect(getAccessToken()).toBeNull();
  });

  // 16
  it('logout очищает токен в памяти и кэш React Query', async () => {
    const { user, queryClient } = renderApp('/login');
    await loginThroughUi(user);

    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    // Logout переехал внутрь profile dropdown — сначала открываем меню.
    await user.click(screen.getByRole('button', { name: /открыть меню профиля/i }));
    await user.click(await screen.findByRole('menuitem', { name: /выйти/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('StrictMode: двойное монтирование AuthProvider даёт ровно один refresh', async () => {
    await authApi.login({ email: TEST_ACCOUNTS.admin, password: DEMO_PASSWORD });
    clearAccessToken();

    const requests = trackRequests(server);
    renderApp('/admin/dashboard', { strictMode: true });

    expect(await screen.findByText('Азиза Раимова')).toBeInTheDocument();

    // Единый bootstrap-промис + single-flight координатор: второй эффект
    // переиспользует уже запущенный запрос, а не шлёт свой.
    expect(countRequests(requests, '/auth/refresh')).toBe(1);
    expect(countRequests(requests, '/auth/me')).toBe(1);
  });

  it('настоящая перезагрузка вкладки восстанавливает сессию: refresh -> me -> authenticated', async () => {
    // До перезагрузки: обычный вход, на «сервере» появилась refresh-сессия.
    const loginResult = await authApi.login({
      email: TEST_ACCOUNTS.admin,
      password: DEMO_PASSWORD,
    });
    persistMockServerState();

    const csrfCookieBeforeReload = document.cookie;

    // Перезагрузка: вся память страницы обнуляется — и приложения, и mock-сервера.
    // document.cookie переживает reload так же, как в настоящем браузере.
    clearAccessToken();
    resetDb();
    clearRefreshCookie();
    expect(readRefreshCookie()).toBeNull();
    expect(getAccessToken()).toBeNull();

    // Ровно то, что делает browser.ts до worker.start().
    expect(restoreMockServerState()).toBe(true);
    expect(readRefreshCookie()).not.toBeNull();
    expect(document.cookie).toBe(csrfCookieBeforeReload);

    const requests = trackRequests(server);
    renderApp('/admin/dashboard');

    expect(await screen.findByText('Азиза Раимова')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/dashboard');

    const refreshIndex = requests.findIndex((entry) => entry.includes('/auth/refresh'));
    const meIndex = requests.findIndex((entry) => entry.includes('/auth/me'));
    expect(refreshIndex).toBeGreaterThanOrEqual(0);
    expect(meIndex).toBeGreaterThan(refreshIndex);

    // Токен после перезагрузки новый и в хранилище не лежал.
    const restoredToken = getAccessToken();
    expect(restoredToken).not.toBeNull();
    expect(restoredToken).not.toBe(loginResult.accessToken);

    // Снапшот mock-сервера в sessionStorage есть, а токенов в нём нет.
    expect(dumpStorage(window.sessionStorage)).toContain('mtf:mock-server-state');
    expectNoTokensInBrowserStorage(loginResult.accessToken, restoredToken);
  });

  it('аутентифицированного пользователя с /login уводит на его дашборд', async () => {
    await authApi.login({ email: TEST_ACCOUNTS.mentor, password: DEMO_PASSWORD });
    clearAccessToken();

    renderApp('/login');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/mentor/dashboard');
    });
  });
});

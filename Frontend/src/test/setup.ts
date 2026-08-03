import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { clearAccessToken } from '../auth/tokenStore';
// Импорт координатора регистрирует single-flight refresh в apiClient —
// без него интерцептор не знал бы, чем чинить 401.
import { resetRefreshCoordinator } from '../auth/refreshCoordinator';
import { clearSessionCookies } from '../mocks/cookies';
import { resetDb } from '../mocks/db';
import { clearMockServerState } from '../mocks/persistence';
import { server } from '../mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  resetDb();
  clearSessionCookies();
  clearAccessToken();
  resetRefreshCoordinator();
  // Снапшот mock-сервера пишет только тест на reload — между кейсами убираем.
  clearMockServerState();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Слушатели request:start ставят отдельные тесты — между кейсами их снимаем.
  server.events.removeAllListeners();
});

afterAll(() => {
  server.close();
});

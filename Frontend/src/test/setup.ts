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

// jsdom не реализует ResizeObserver — им пользуются компоненты вроде
// `DashboardRankingRow` для проверки truncation. Реальный layout в тестах не
// нужен, поэтому достаточно no-op заглушки, как делает testing-library для Popper и т.п.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom тоже не реализует window.matchMedia (нужен `useFloatingChartTooltip`
// для `prefers-reduced-motion`) — статичный MediaQueryList с matches: false,
// тот же приём, что общепринятая заглушка для jsdom в CRA/Next тестах.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

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
  // jsdom держит один `window` на весь файл — без очистки выбор филиала
  // (`BranchContext`, персистится в localStorage per-user) утёк бы из одного
  // теста в другой, если оба используют одного mock-пользователя.
  window.localStorage.clear();
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

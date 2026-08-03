import { setupWorker } from 'msw/browser';

import { clearSessionCookies } from './cookies';
import { db, findUserByEmail, resetDb } from './db';
import { authHandlers } from './handlers/auth';
import { branchesHandlers } from './handlers/branches';
import { dashboardHandlers } from './handlers/dashboard';
import { organizationHandlers } from './handlers/organization';
import {
  clearMockServerState,
  persistMockServerState,
  restoreMockServerState,
} from './persistence';
import { clearRateLimits } from './rateLimit';
import { DEMO_PASSWORD } from './scenarios';
import { createSecurityToken, expireAllAccessTokens } from './tokens';

// Поднимаем состояние «сервера» до старта worker'а — иначе первый же
// bootstrap-refresh не нашёл бы сессию, выданную до перезагрузки.
const restored = restoreMockServerState();

export const worker = setupWorker(
  ...authHandlers,
  ...organizationHandlers,
  ...branchesHandlers,
  ...dashboardHandlers,
);

// Единственная точка сохранения: после каждого замоканного ответа.
// Хендлеры об этом не знают и остаются чистыми.
worker.events.on('response:mocked', () => {
  persistMockServerState();
});

/** Утилиты ручного QA. В консоли доступны как `window.mtfMocks`. */
interface MockDevtools {
  reset: () => string;
  expireAccessTokens: () => string;
  bumpTokenVersion: (email: string) => string;
  lockAccount: (email: string) => string;
  unlockAccount: (email: string) => string;
  issueResetLink: (email: string) => string;
  issueInviteLink: (email: string) => string;
  clearRateLimits: () => string;
  state: () => unknown;
  password: string;
}

declare global {
  interface Window {
    mtfMocks?: MockDevtools;
  }
}

const devtools: MockDevtools = {
  reset: () => {
    resetDb();
    clearSessionCookies();
    clearMockServerState();
    return 'Состояние моков сброшено. Обновите страницу.';
  },

  expireAccessTokens: () => {
    expireAllAccessTokens();
    return 'Access-токены помечены истёкшими — следующий запрос уйдёт в silent refresh.';
  },

  bumpTokenVersion: (email) => {
    const user = findUserByEmail(email);
    if (user === undefined) return `Пользователь ${email} не найден`;
    user.tokenVersion += 1;
    return `TokenVersion ${email} = ${String(user.tokenVersion)}`;
  },

  lockAccount: (email) => {
    const user = findUserByEmail(email);
    if (user === undefined) return `Пользователь ${email} не найден`;
    user.lockoutUntil = Date.now() + 15 * 60 * 1000;
    return `${email} заблокирован на 15 минут`;
  },

  unlockAccount: (email) => {
    const user = findUserByEmail(email);
    if (user === undefined) return `Пользователь ${email} не найден`;
    user.lockoutUntil = null;
    user.failedLoginCount = 0;
    return `${email} разблокирован`;
  },

  issueResetLink: (email) => {
    const user = findUserByEmail(email);
    if (user === undefined) return `Пользователь ${email} не найден`;
    const token = createSecurityToken(user.id, 'ResetPassword');
    return `${window.location.origin}/reset-password?token=${token}`;
  },

  issueInviteLink: (email) => {
    const user = findUserByEmail(email);
    if (user === undefined) return `Пользователь ${email} не найден`;
    const token = createSecurityToken(user.id, 'SetPassword');
    return `${window.location.origin}/set-password?token=${token}`;
  },

  clearRateLimits: () => {
    clearRateLimits();
    return 'Счётчики rate limit обнулены.';
  },

  state: () => ({
    users: db.users,
    refreshSessions: db.refreshSessions,
    securityTokens: db.securityTokens,
    rateLimitBuckets: db.rateLimitBuckets,
    auditEvents: db.auditEvents,
  }),

  password: DEMO_PASSWORD,
};

window.mtfMocks = devtools;

console.info(
  `[MSW] Моки включены${restored ? ' (состояние сессии восстановлено после перезагрузки)' : ''}. ` +
    'Тестовые учётки — в блоке «Тестовые данные» на /login, утилиты — window.mtfMocks',
);

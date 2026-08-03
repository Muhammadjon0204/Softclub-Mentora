import { HttpResponse, delay, http } from 'msw';

import type { AuthErrorCode, ApiProblemDetails } from '../../api/problemDetails';
import type { LoginResponse } from '../../api/auth';
import { createCorrelationId } from '../../lib/correlationId';
import {
  EXPIRED_CSRF_SET_COOKIE,
  clearSessionCookies,
  readCsrfCookie,
  readRefreshCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '../cookies';
import { audit, db, findUserByEmail, toAuthUser, type MockUser } from '../db';
import { RATE_LIMIT_RULES, consumeRateLimit } from '../rateLimit';
import { ACCOUNT_LOCKOUT } from '../scenarios';
import {
  consumeSecurityToken,
  createRefreshSession,
  createSecurityToken,
  findUsableSecurityToken,
  issueAccessToken,
  revokeAllUserSessions,
  revokeSession,
  rotateRefreshSession,
  verifyAccessToken,
  verifyRefreshToken,
} from '../tokens';

/* ------------------------------------------------------------------ */
/* Инфраструктура ответов                                              */
/* ------------------------------------------------------------------ */

/** Совпадает с любым baseURL — и с same-origin, и с https://api.<domain>. */
const route = (path: string): string => `*/api/v1/auth/${path}`;

/** В тестах задержка только мешает; в браузере имитирует живую сеть. */
const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 320;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
} as const;

function correlationIdOf(request: Request): string {
  const header = request.headers.get('X-Correlation-Id');
  return header !== null && header.length > 0 ? header : createCorrelationId();
}

const PROBLEM_TITLE: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  REFRESH_TOKEN_INVALID: 'Refresh token invalid',
  REFRESH_TOKEN_REUSE_DETECTED: 'Refresh token reuse detected',
  CSRF_VALIDATION_FAILED: 'CSRF validation failed',
  UNAUTHORIZED: 'Unauthorized',
  TOKEN_EXPIRED: 'Access token expired',
  TOKEN_VERSION_MISMATCH: 'Token version mismatch',
  VALIDATION_FAILED: 'Validation failed',
  SECURITY_TOKEN_INVALID: 'Security token invalid',
  USER_DEACTIVATED: 'User deactivated',
};

interface ProblemInit {
  status: number;
  code: AuthErrorCode;
  detail: string;
  instance: string;
  correlationId: string;
  errors?: Record<string, string[]>;
  headers?: Record<string, string>;
}

function problem(init: ProblemInit) {
  const body: ApiProblemDetails = {
    type: `https://mentortaskflow.example/problems/${init.code.toLowerCase().replace(/_/g, '-')}`,
    title: PROBLEM_TITLE[init.code],
    status: init.status,
    code: init.code,
    detail: init.detail,
    instance: init.instance,
    // traceId всегда равен X-Correlation-Id ответа.
    traceId: init.correlationId,
    errors: init.errors ?? {},
  };

  return HttpResponse.json(body, {
    status: init.status,
    headers: {
      'Content-Type': 'application/problem+json',
      'X-Correlation-Id': init.correlationId,
      ...init.headers,
    },
  });
}

function okHeaders(correlationId: string, noStore = false): Record<string, string> {
  return {
    'X-Correlation-Id': correlationId,
    ...(noStore ? NO_STORE_HEADERS : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Валидация на стороне «сервера»                                      */
/* ------------------------------------------------------------------ */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Фрагмент списка top-10000. Полный словарь живёт только на сервере —
 * клиенту его не отдают и клиент эту проверку не дублирует.
 */
const COMMON_PASSWORDS = new Set([
  'Password1234',
  'Qwerty123456',
  'Welcome12345',
  'Admin1234567',
  'Passw0rd1234',
  'Football1234',
  'Iloveyou1234',
]);

function validateNewPassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 12 || password.length > 128) {
    problems.push('Пароль должен содержать от 12 до 128 символов');
  }
  if (!/[A-Z]/.test(password)) problems.push('Пароль должен содержать заглавную букву');
  if (!/\d/.test(password)) problems.push('Пароль должен содержать цифру');
  if (COMMON_PASSWORDS.has(password)) {
    problems.push('Этот пароль встречается в списке часто используемых');
  }
  return problems;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Сессия                                                              */
/* ------------------------------------------------------------------ */

function startSession(user: MockUser): { accessToken: string } {
  const session = createRefreshSession(user);
  setRefreshCookie(session.tokenValue);
  setCsrfCookie(session.csrfToken);
  return { accessToken: issueAccessToken(user, session.id) };
}

function isCsrfValid(request: Request): boolean {
  const header = request.headers.get('X-CSRF-Token');
  const cookie = readCsrfCookie();
  return header !== null && cookie !== null && header === cookie;
}

/* ------------------------------------------------------------------ */
/* POST /api/v1/auth/login                                             */
/* ------------------------------------------------------------------ */

const loginHandler = http.post(route('login'), async ({ request }) => {
  const correlationId = correlationIdOf(request);
  const instance = '/api/v1/auth/login';

  const limit = consumeRateLimit('login', RATE_LIMIT_RULES.login);
  if (!limit.allowed) {
    return problem({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      detail: 'Превышен лимит запросов на вход',
      instance,
      correlationId,
      headers: { 'Retry-After': String(limit.retryAfterSec) },
    });
  }

  await delay(LATENCY_MS);

  const body = await readJsonBody(request);
  const email = asString(body['email']).trim();
  const password = asString(body['password']);

  const fieldErrors: Record<string, string[]> = {};
  if (email.length === 0) fieldErrors['email'] = ['Введите email'];
  else if (!EMAIL_PATTERN.test(email)) fieldErrors['email'] = ['Введите корректный email'];
  if (password.length === 0) fieldErrors['password'] = ['Введите пароль'];

  if (Object.keys(fieldErrors).length > 0) {
    return problem({
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'Проверьте правильность заполнения полей',
      instance,
      correlationId,
      errors: fieldErrors,
    });
  }

  /**
   * Единый отказ. Ни статус, ни тело, ни тайминг не должны различать
   * «нет такого пользователя», «неверный пароль», «lockout»,
   * «пароль не задан» и «пользователь отключён».
   */
  const invalidCredentials = () =>
    problem({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      detail: 'Неверный email или пароль',
      instance,
      correlationId,
    });

  const user = findUserByEmail(email);
  if (user === undefined) return invalidCredentials();

  // Истёкший lockout снимаем перед проверкой.
  if (user.lockoutUntil !== null && user.lockoutUntil <= Date.now()) {
    user.lockoutUntil = null;
    user.failedLoginCount = 0;
  }

  if (!user.isActive || user.lockoutUntil !== null || user.passwordHash === null) {
    audit('login_denied', user.id, 'inactive/locked/no-password');
    return invalidCredentials();
  }

  if (user.passwordHash !== password) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= ACCOUNT_LOCKOUT.maxFailedAttempts) {
      // Account lockout — механизм уровня учётной записи, он отвечает 401,
      // а не 429: 429 отдаёт только route rate limiter.
      user.lockoutUntil = Date.now() + ACCOUNT_LOCKOUT.durationMs;
      audit('account_locked', user.id, `after ${String(user.failedLoginCount)} attempts`);
    }
    return invalidCredentials();
  }

  user.failedLoginCount = 0;
  user.lockoutUntil = null;

  const { accessToken } = startSession(user);
  audit('login_success', user.id, user.email);

  const payload: LoginResponse = { accessToken, user: toAuthUser(user) };
  return HttpResponse.json(payload, { status: 200, headers: okHeaders(correlationId, true) });
});

/* ------------------------------------------------------------------ */
/* POST /api/v1/auth/refresh                                           */
/* ------------------------------------------------------------------ */

const refreshHandler = http.post(route('refresh'), async ({ request }) => {
  const correlationId = correlationIdOf(request);
  const instance = '/api/v1/auth/refresh';

  await delay(LATENCY_MS);

  const presentedToken = readRefreshCookie();

  // Сессии нет вовсе (первый визит) — это не CSRF-инцидент, а отсутствие сессии.
  // Проверять CSRF раньше значило бы пугать любого анонимного посетителя.
  if (presentedToken === null) {
    return problem({
      status: 401,
      code: 'REFRESH_TOKEN_INVALID',
      detail: 'Сессия не найдена',
      instance,
      correlationId,
    });
  }

  if (!isCsrfValid(request)) {
    return problem({
      status: 403,
      code: 'CSRF_VALIDATION_FAILED',
      detail: 'X-CSRF-Token не совпадает с cookie mtf_csrf',
      instance,
      correlationId,
    });
  }

  const verdict = verifyRefreshToken(presentedToken);
  if (!verdict.ok) {
    clearSessionCookies();
    return problem({
      status: 401,
      code: verdict.code,
      detail:
        verdict.code === 'REFRESH_TOKEN_REUSE_DETECTED'
          ? 'Обнаружено повторное использование refresh-токена'
          : 'Refresh-токен недействителен',
      instance,
      correlationId,
      headers: { 'Set-Cookie': EXPIRED_CSRF_SET_COOKIE },
    });
  }

  const nextSession = rotateRefreshSession(verdict.session, verdict.user);
  setRefreshCookie(nextSession.tokenValue);
  setCsrfCookie(nextSession.csrfToken);

  const accessToken = issueAccessToken(verdict.user, nextSession.id);
  return HttpResponse.json(
    { accessToken },
    { status: 200, headers: okHeaders(correlationId, true) },
  );
});

/* ------------------------------------------------------------------ */
/* POST /api/v1/auth/logout                                            */
/* ------------------------------------------------------------------ */

const logoutHandler = http.post(route('logout'), async ({ request }) => {
  const correlationId = correlationIdOf(request);
  const instance = '/api/v1/auth/logout';

  await delay(LATENCY_MS);

  const presentedToken = readRefreshCookie();

  // Идемпотентность: сессии уже нет — всё равно 204.
  if (presentedToken === null) {
    clearSessionCookies();
    return new HttpResponse(null, {
      status: 204,
      headers: { ...okHeaders(correlationId), 'Set-Cookie': EXPIRED_CSRF_SET_COOKIE },
    });
  }

  if (!isCsrfValid(request)) {
    return problem({
      status: 403,
      code: 'CSRF_VALIDATION_FAILED',
      detail: 'X-CSRF-Token не совпадает с cookie mtf_csrf',
      instance,
      correlationId,
    });
  }

  const session = db.refreshSessions.find((item) => item.tokenValue === presentedToken);
  if (session !== undefined) {
    revokeSession(session, 'logout');
    audit('logout', session.userId, session.id);
  }

  clearSessionCookies();
  return new HttpResponse(null, {
    status: 204,
    headers: { ...okHeaders(correlationId), 'Set-Cookie': EXPIRED_CSRF_SET_COOKIE },
  });
});

/* ------------------------------------------------------------------ */
/* GET /api/v1/auth/me                                                 */
/* ------------------------------------------------------------------ */

const meHandler = http.get(route('me'), async ({ request }) => {
  const correlationId = correlationIdOf(request);

  await delay(LATENCY_MS);

  const verdict = verifyAccessToken(request.headers.get('Authorization'));
  if (!verdict.ok) {
    return problem({
      status: 401,
      code: verdict.code,
      detail: 'Требуется действующий access-токен',
      instance: '/api/v1/auth/me',
      correlationId,
    });
  }

  return HttpResponse.json(toAuthUser(verdict.user), {
    status: 200,
    headers: okHeaders(correlationId),
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/v1/auth/change-password                                   */
/* ------------------------------------------------------------------ */

const changePasswordHandler = http.post(route('change-password'), async ({ request }) => {
  const correlationId = correlationIdOf(request);
  const instance = '/api/v1/auth/change-password';

  await delay(LATENCY_MS);

  const verdict = verifyAccessToken(request.headers.get('Authorization'));
  if (!verdict.ok) {
    return problem({
      status: 401,
      code: verdict.code,
      detail: 'Требуется действующий access-токен',
      instance,
      correlationId,
    });
  }

  const body = await readJsonBody(request);
  const currentPassword = asString(body['currentPassword']);
  const newPassword = asString(body['newPassword']);

  const passwordProblems = validateNewPassword(newPassword);
  if (passwordProblems.length > 0) {
    return problem({
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'Новый пароль не соответствует требованиям',
      instance,
      correlationId,
      errors: { newPassword: passwordProblems },
    });
  }

  const { user, sessionId } = verdict;
  if (user.passwordHash !== currentPassword) {
    return problem({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      detail: 'Текущий пароль неверен',
      instance,
      correlationId,
    });
  }

  user.passwordHash = newPassword;
  user.tokenVersion += 1;

  // Все прочие сессии отзываем, текущей выдаём новую пару.
  revokeAllUserSessions(user.id, 'password_changed', sessionId);

  const current = db.refreshSessions.find((item) => item.id === sessionId);
  let activeSessionId = sessionId;
  if (current !== undefined) {
    const rotated = rotateRefreshSession(current, user);
    setRefreshCookie(rotated.tokenValue);
    setCsrfCookie(rotated.csrfToken);
    activeSessionId = rotated.id;
  }

  const accessToken = issueAccessToken(user, activeSessionId);
  audit('password_changed', user.id, user.email);

  return HttpResponse.json(
    { accessToken },
    { status: 200, headers: okHeaders(correlationId, true) },
  );
});

/* ------------------------------------------------------------------ */
/* POST /api/v1/auth/forgot-password                                   */
/* ------------------------------------------------------------------ */

const FORGOT_PASSWORD_MESSAGE =
  'Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.';

const forgotPasswordHandler = http.post(route('forgot-password'), async ({ request }) => {
  const correlationId = correlationIdOf(request);
  const instance = '/api/v1/auth/forgot-password';

  const limit = consumeRateLimit('forgot-password', RATE_LIMIT_RULES.forgotPassword);
  if (!limit.allowed) {
    return problem({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      detail: 'Превышен лимит запросов на восстановление пароля',
      instance,
      correlationId,
      headers: { 'Retry-After': String(limit.retryAfterSec) },
    });
  }

  await delay(LATENCY_MS);

  const body = await readJsonBody(request);
  const email = asString(body['email']).trim();

  if (email.length === 0 || !EMAIL_PATTERN.test(email)) {
    return problem({
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'Проверьте правильность заполнения полей',
      instance,
      correlationId,
      errors: { email: ['Введите корректный email'] },
    });
  }

  const user = findUserByEmail(email);
  if (user !== undefined && user.isActive) {
    const token = createSecurityToken(user.id, 'ResetPassword');
    // Письма нет — печатаем ссылку в консоль для ручного QA.
    console.info(
      `[MSW] Ссылка сброса для ${user.email}: ${window.location.origin}/reset-password?token=${token}`,
    );
  }

  // Один и тот же 202 и для существующего email, и для неизвестного,
  // и для отключённого пользователя.
  return HttpResponse.json(
    { message: FORGOT_PASSWORD_MESSAGE },
    { status: 202, headers: okHeaders(correlationId) },
  );
});

/* ------------------------------------------------------------------ */
/* POST /api/v1/auth/reset-password  и  /set-password                  */
/* ------------------------------------------------------------------ */

async function handlePasswordByToken(request: Request, purpose: 'ResetPassword' | 'SetPassword') {
  const correlationId = correlationIdOf(request);
  const isReset = purpose === 'ResetPassword';
  const instance = isReset ? '/api/v1/auth/reset-password' : '/api/v1/auth/set-password';

  const limit = consumeRateLimit(
    instance,
    isReset ? RATE_LIMIT_RULES.resetPassword : RATE_LIMIT_RULES.setPassword,
  );
  if (!limit.allowed) {
    return problem({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      detail: 'Превышен лимит запросов',
      instance,
      correlationId,
      headers: { 'Retry-After': String(limit.retryAfterSec) },
    });
  }

  await delay(LATENCY_MS);

  const body = await readJsonBody(request);
  const token = asString(body['token']);
  const newPassword = asString(body['newPassword']);

  const record = token.length === 0 ? null : findUsableSecurityToken(token, purpose);
  if (record === null) {
    // Отсутствует, истёк, использован, инвалидирован или не то назначение —
    // ответ во всех случаях один и тот же.
    return problem({
      status: 400,
      code: 'SECURITY_TOKEN_INVALID',
      detail: 'Ссылка недействительна или устарела',
      instance,
      correlationId,
    });
  }

  const passwordProblems = validateNewPassword(newPassword);
  if (passwordProblems.length > 0) {
    return problem({
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'Пароль не соответствует требованиям',
      instance,
      correlationId,
      errors: { newPassword: passwordProblems },
    });
  }

  const user = db.users.find((item) => item.id === record.userId);
  if (user === undefined) {
    return problem({
      status: 400,
      code: 'SECURITY_TOKEN_INVALID',
      detail: 'Ссылка недействительна или устарела',
      instance,
      correlationId,
    });
  }

  user.passwordHash = newPassword;
  user.failedLoginCount = 0;
  user.lockoutUntil = null;
  user.tokenVersion += 1;
  consumeSecurityToken(record);
  revokeAllUserSessions(user.id, isReset ? 'password_reset' : 'password_set');
  clearSessionCookies();
  audit(isReset ? 'password_reset' : 'password_set', user.id, user.email);

  // Тело успешного ответа пустое — API-функция на него не опирается.
  return new HttpResponse(null, {
    status: 200,
    headers: { ...okHeaders(correlationId), 'Set-Cookie': EXPIRED_CSRF_SET_COOKIE },
  });
}

const resetPasswordHandler = http.post(route('reset-password'), ({ request }) =>
  handlePasswordByToken(request, 'ResetPassword'),
);

const setPasswordHandler = http.post(route('set-password'), ({ request }) =>
  handlePasswordByToken(request, 'SetPassword'),
);

export const authHandlers = [
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  changePasswordHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  setPasswordHandler,
];

/* eslint-disable no-restricted-globals -- см. комментарий ниже: это состояние mock-СЕРВЕРА */

import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './cookies';
import { db, type MockDb } from './db';

/**
 * Development-only персистентность состояния mock-«сервера».
 *
 * Зачем: MSW живёт внутри той же страницы, что и приложение. Без сохранения
 * после настоящего F5 «сервер» забывал бы про выданную refresh-сессию, и цепочка
 * `refresh -> me -> authenticated` никогда не воспроизводилась бы вручную.
 *
 * Что здесь ЛЕЖИТ — исключительно серверная сторона мока:
 *   users, refreshSessions, securityTokens, rateLimitBuckets, auditEvents
 *   и непрозрачное значение HttpOnly-cookie `mtf_rt`.
 *
 * Что здесь НЕ ЛЕЖИТ И НЕ БУДЕТ:
 *   • accessToken — он обязан жить только в памяти и пропадать при reload;
 *   • профиль аутентифицированного пользователя как клиентское состояние —
 *     после reload он заново приезжает из `GET /auth/me`.
 *
 * Кто читает: только модули внутри `src/mocks/`. Код приложения об этом
 * хранилище не знает — ESLint запрещает ему `sessionStorage` целиком,
 * а исключение из правила выдано ровно этому файлу.
 *
 * Почему sessionStorage, а не localStorage: состояние обязано умирать вместе
 * с вкладкой, как умерла бы сессия тестового сервера.
 */

const STORAGE_KEY = 'mtf:mock-server-state:v1';
const SNAPSHOT_VERSION = 1;

interface MockServerSnapshot {
  version: number;
  users: MockDb['users'];
  refreshSessions: MockDb['refreshSessions'];
  securityTokens: MockDb['securityTokens'];
  rateLimitBuckets: MockDb['rateLimitBuckets'];
  auditEvents: MockDb['auditEvents'];
  /** Непрозрачное значение cookie `mtf_rt`. Access-токенов тут нет и быть не может. */
  refreshCookie: string | null;
}

function isEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_MOCKS === 'true' &&
    typeof sessionStorage !== 'undefined'
  );
}

export function persistMockServerState(): void {
  if (!isEnabled()) return;

  const snapshot: MockServerSnapshot = {
    version: SNAPSHOT_VERSION,
    users: db.users,
    refreshSessions: db.refreshSessions,
    securityTokens: db.securityTokens,
    rateLimitBuckets: db.rateLimitBuckets,
    // Журнал ограничиваем, чтобы не упереться в квоту за долгую сессию отладки.
    auditEvents: db.auditEvents.slice(-200),
    refreshCookie: readRefreshCookie(),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Приватный режим или превышена квота — мок продолжит работать в памяти.
  }
}

/** Возвращает `true`, если состояние прошлой вкладки удалось восстановить. */
export function restoreMockServerState(): boolean {
  if (!isEnabled()) return false;

  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
  if (raw === null) return false;

  let snapshot: MockServerSnapshot;
  try {
    snapshot = JSON.parse(raw) as MockServerSnapshot;
  } catch {
    clearMockServerState();
    return false;
  }

  if (snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.users)) {
    clearMockServerState();
    return false;
  }

  db.users = snapshot.users;
  db.refreshSessions = snapshot.refreshSessions;
  db.securityTokens = snapshot.securityTokens;
  db.rateLimitBuckets = snapshot.rateLimitBuckets;
  db.auditEvents = snapshot.auditEvents;

  // Access-токены сознательно НЕ восстанавливаем: после reload их не должно
  // существовать ни на клиенте, ни на «сервере» — иначе тест на silent refresh
  // проходил бы по ложной причине.
  db.accessTokens = [];

  if (snapshot.refreshCookie !== null) setRefreshCookie(snapshot.refreshCookie);
  else clearRefreshCookie();

  return true;
}

export function clearMockServerState(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

import { createCorrelationId } from '../lib/correlationId';
import {
  audit,
  db,
  findUserById,
  type MockUser,
  type RefreshSession,
  type SecurityToken,
  type SecurityTokenPurpose,
} from './db';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, SECURITY_TOKEN_TTL } from './scenarios';

/** Непрозрачные значения: клиенту незачем уметь их разбирать. */
export function createOpaqueToken(prefix: string): string {
  return `${prefix}_${createCorrelationId().replace(/-/g, '')}`;
}

/* ------------------------------ access token ----------------------------- */

export function issueAccessToken(user: MockUser, sessionId: string): string {
  const token = createOpaqueToken('at');
  db.accessTokens.push({
    token,
    userId: user.id,
    sessionId,
    tokenVersion: user.tokenVersion,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL,
  });
  return token;
}

export type AccessTokenFailure = 'UNAUTHORIZED' | 'TOKEN_EXPIRED' | 'TOKEN_VERSION_MISMATCH';

export type AccessTokenVerdict =
  | { ok: true; user: MockUser; sessionId: string }
  | { ok: false; code: AccessTokenFailure };

export function verifyAccessToken(authorizationHeader: string | null): AccessTokenVerdict {
  if (authorizationHeader === null || !authorizationHeader.startsWith('Bearer ')) {
    return { ok: false, code: 'UNAUTHORIZED' };
  }

  const value = authorizationHeader.slice('Bearer '.length);
  const record = db.accessTokens.find((item) => item.token === value);
  if (record === undefined) return { ok: false, code: 'UNAUTHORIZED' };

  if (record.expiresAt <= Date.now()) return { ok: false, code: 'TOKEN_EXPIRED' };

  const user = findUserById(record.userId);
  if (user === undefined || !user.isActive) return { ok: false, code: 'UNAUTHORIZED' };

  // TokenVersion изменился => пароль сменили или сессии отозвали.
  if (user.tokenVersion !== record.tokenVersion) {
    return { ok: false, code: 'TOKEN_VERSION_MISMATCH' };
  }

  const session = db.refreshSessions.find((item) => item.id === record.sessionId);
  if (session === undefined || session.revokedAt !== null) {
    return { ok: false, code: 'UNAUTHORIZED' };
  }

  return { ok: true, user, sessionId: record.sessionId };
}

/** Для QA: пометить выданные access-токены истёкшими, не трогая refresh-сессию. */
export function expireAllAccessTokens(): void {
  for (const record of db.accessTokens) record.expiresAt = 0;
}

/* ----------------------------- refresh session ---------------------------- */

export function createRefreshSession(user: MockUser): RefreshSession {
  const session: RefreshSession = {
    id: createOpaqueToken('sess'),
    userId: user.id,
    tokenValue: createOpaqueToken('rt'),
    familyId: createOpaqueToken('fam'),
    csrfToken: createOpaqueToken('csrf'),
    expiresAt: Date.now() + REFRESH_TOKEN_TTL,
    revokedAt: null,
    replacedById: null,
    reasonRevoked: null,
  };
  db.refreshSessions.push(session);
  audit('refresh_session_created', user.id, session.familyId);
  return session;
}

export function revokeSession(session: RefreshSession, reason: string): void {
  if (session.revokedAt === null) {
    session.revokedAt = Date.now();
    session.reasonRevoked = reason;
  }
  db.accessTokens = db.accessTokens.filter((token) => token.sessionId !== session.id);
}

export function revokeFamily(familyId: string, reason: string): void {
  for (const session of db.refreshSessions) {
    if (session.familyId === familyId) revokeSession(session, reason);
  }
  audit('refresh_family_revoked', null, `${familyId}: ${reason}`);
}

export function revokeAllUserSessions(
  userId: string,
  reason: string,
  exceptSessionId?: string,
): void {
  for (const session of db.refreshSessions) {
    if (session.userId === userId && session.id !== exceptSessionId) {
      revokeSession(session, reason);
    }
  }
  audit('user_sessions_revoked', userId, reason);
}

export type RefreshFailure = 'REFRESH_TOKEN_INVALID' | 'REFRESH_TOKEN_REUSE_DETECTED';

export type RefreshVerdict =
  | { ok: true; session: RefreshSession; user: MockUser }
  | { ok: false; code: RefreshFailure };

export function verifyRefreshToken(tokenValue: string | null): RefreshVerdict {
  if (tokenValue === null) return { ok: false, code: 'REFRESH_TOKEN_INVALID' };

  const session = db.refreshSessions.find((item) => item.tokenValue === tokenValue);
  if (session === undefined) return { ok: false, code: 'REFRESH_TOKEN_INVALID' };

  if (session.revokedAt !== null) {
    // Ротированный токен остаётся в хранилище именно ради этой проверки:
    // его повторное предъявление означает, что копию кто-то перехватил.
    if (session.reasonRevoked === 'rotated') {
      revokeFamily(session.familyId, 'reuse_detected');

      const user = findUserById(session.userId);
      if (user !== undefined) {
        user.tokenVersion += 1;
        db.accessTokens = db.accessTokens.filter((token) => token.userId !== user.id);
        audit('token_reuse_detected', user.id, session.familyId);
      }
      return { ok: false, code: 'REFRESH_TOKEN_REUSE_DETECTED' };
    }
    return { ok: false, code: 'REFRESH_TOKEN_INVALID' };
  }

  if (session.expiresAt <= Date.now()) return { ok: false, code: 'REFRESH_TOKEN_INVALID' };

  const user = findUserById(session.userId);
  if (user === undefined || !user.isActive) return { ok: false, code: 'REFRESH_TOKEN_INVALID' };

  return { ok: true, session, user };
}

/** Ротация: старая сессия помечается `rotated`, наследник продолжает family. */
export function rotateRefreshSession(session: RefreshSession, user: MockUser): RefreshSession {
  const next: RefreshSession = {
    id: createOpaqueToken('sess'),
    userId: session.userId,
    tokenValue: createOpaqueToken('rt'),
    familyId: session.familyId,
    // CSRF-токен переживает ротацию — так требует контракт.
    csrfToken: session.csrfToken,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL,
    revokedAt: null,
    replacedById: null,
    reasonRevoked: null,
  };

  db.refreshSessions.push(next);

  session.revokedAt = Date.now();
  session.reasonRevoked = 'rotated';
  session.replacedById = next.id;
  db.accessTokens = db.accessTokens.filter((token) => token.sessionId !== session.id);

  audit('refresh_rotated', user.id, `${session.id} -> ${next.id}`);
  return next;
}

/* ----------------------------- security tokens ---------------------------- */

export function createSecurityToken(userId: string, purpose: SecurityTokenPurpose): string {
  const token = createOpaqueToken(purpose === 'ResetPassword' ? 'rst' : 'inv');
  db.securityTokens.push({
    token,
    userId,
    purpose,
    expiresAt: Date.now() + SECURITY_TOKEN_TTL[purpose],
    usedAt: null,
  });
  return token;
}

/** Возвращает токен только если он валиден для указанного назначения. */
export function findUsableSecurityToken(
  token: string,
  purpose: SecurityTokenPurpose,
): SecurityToken | null {
  const record = db.securityTokens.find((item) => item.token === token);
  if (record === undefined) return null;
  if (record.purpose !== purpose) return null;
  if (record.usedAt !== null) return null;
  if (record.expiresAt <= Date.now()) return null;
  return record;
}

export function consumeSecurityToken(record: SecurityToken): void {
  record.usedAt = Date.now();
  audit('security_token_used', record.userId, record.purpose);
}

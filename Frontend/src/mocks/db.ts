import type { AdminScope, AuthUser, UserRole } from '../api/auth';
import { branchSummary, ORGANIZATION } from './domain/organization';
import { seedDb } from './scenarios';

/**
 * In-memory состояние mock-«сервера».
 *
 * ВАЖНО: никакой персистентности. Ни localStorage, ни sessionStorage —
 * состояние живёт ровно столько, сколько живёт вкладка. Следствие: перезагрузка
 * страницы в mock-режиме честно завершает сессию, потому что «сервер»
 * находится внутри той же страницы. С реальным backend этого не происходит.
 */

export type SecurityTokenPurpose = 'ResetPassword' | 'SetPassword';

export interface MockUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  /** Присутствует только при role='Admin' (ТЗ 2.2, раздел 8.5). */
  adminScope: AdminScope | null;
  organizationId: string;
  /** `null` только при role='Admin' && adminScope='Organization'. */
  branchId: string | null;
  categoryId: string | null;
  /** `null` эмулирует `PasswordHash IS NULL` — онбординг не завершён. */
  passwordHash: string | null;
  isActive: boolean;
  /** Инкремент инвалидирует все ранее выданные access- и refresh-токены. */
  tokenVersion: number;
  failedLoginCount: number;
  /** Метка времени окончания lockout. */
  lockoutUntil: number | null;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface RefreshSession {
  id: string;
  userId: string;
  /** Непрозрачное значение, которое лежит в cookie `mtf_rt`. */
  tokenValue: string;
  /** Цепочка ротаций одной и той же сессии. */
  familyId: string;
  csrfToken: string;
  expiresAt: number;
  revokedAt: number | null;
  replacedById: string | null;
  reasonRevoked: string | null;
}

export interface SecurityToken {
  token: string;
  userId: string;
  purpose: SecurityTokenPurpose;
  expiresAt: number;
  usedAt: number | null;
}

export interface AccessTokenRecord {
  token: string;
  userId: string;
  sessionId: string;
  tokenVersion: number;
  expiresAt: number;
}

export interface RateLimitBucket {
  windowStartedAt: number;
  count: number;
}

export interface AuditEvent {
  at: number;
  type: string;
  userId: string | null;
  detail: string;
  /** Арендный scope события (ТЗ 2.2, AuditLog). Отсутствует у auth-событий версии 2.1. */
  organizationId?: string;
  branchId?: string | null;
  categoryId?: string | null;
  actorRole?: UserRole | null;
  actorAdminScope?: AdminScope | null;
  entityType?: string;
  entityId?: string;
  result?: 'Success' | 'Failure';
  correlationId?: string;
}

export interface MockDb {
  users: MockUser[];
  refreshSessions: RefreshSession[];
  securityTokens: SecurityToken[];
  accessTokens: AccessTokenRecord[];
  rateLimitBuckets: Record<string, RateLimitBucket>;
  auditEvents: AuditEvent[];
}

export const db: MockDb = {
  users: [],
  refreshSessions: [],
  securityTokens: [],
  accessTokens: [],
  rateLimitBuckets: {},
  auditEvents: [],
};

/** Полный сброс к исходному сценарию — используется тестами между кейсами. */
export function resetDb(): void {
  const seed = seedDb();
  db.users = seed.users;
  db.refreshSessions = [];
  db.securityTokens = seed.securityTokens;
  db.accessTokens = [];
  db.rateLimitBuckets = {};
  db.auditEvents = [];
}

export interface AuditScopeMeta {
  organizationId?: string;
  branchId?: string | null;
  categoryId?: string | null;
  actorRole?: UserRole | null;
  actorAdminScope?: AdminScope | null;
  entityType?: string;
  entityId?: string;
  result?: 'Success' | 'Failure';
  correlationId?: string;
}

export function audit(
  type: string,
  userId: string | null,
  detail: string,
  meta?: AuditScopeMeta,
): void {
  db.auditEvents.push({ at: Date.now(), type, userId, detail, ...meta });
}

export function findUserByEmail(email: string): MockUser | undefined {
  const normalized = email.trim().toLowerCase();
  return db.users.find((user) => user.email.toLowerCase() === normalized);
}

export function findUserById(id: string): MockUser | undefined {
  return db.users.find((user) => user.id === id);
}

/** Публичная проекция пользователя — ровно то, что уходит клиенту. */
export function toAuthUser(user: MockUser): AuthUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    adminScope: user.adminScope,
    organization: { id: ORGANIZATION.id, name: ORGANIZATION.name },
    branch: branchSummary(user.branchId),
    categoryId: user.categoryId,
  };
}

resetDb();

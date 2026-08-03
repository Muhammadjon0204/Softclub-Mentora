import type { AdminScope, UserRole } from '../../api/auth';
import { db, findUserById } from '../db';
import {
  BRANCH_BOKHTAR,
  BRANCH_HEAD_OFFICE,
  BRANCH_KHUJAND,
  ORGANIZATION,
} from './organization';
import { DAY_MS, HOUR_MS, MOCK_NOW } from './reference';

export interface AuditLogEntry {
  id: string;
  at: number;
  organizationId: string;
  branchId: string | null;
  categoryId: string | null;
  actorId: string | null;
  actorLabel: string;
  actorRole: UserRole | 'System';
  actorAdminScope: AdminScope | null;
  action: string;
  entityType: string;
  entityId: string | null;
  result: 'Success' | 'Failure';
  correlationId: string;
}

interface SeedEntry {
  id: string;
  offsetMs: number;
  branchId: string | null;
  categoryId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  result?: 'Success' | 'Failure';
}

const SEED: SeedEntry[] = [
  {
    id: 'aud-001',
    offsetMs: 420 * DAY_MS,
    branchId: null,
    categoryId: null,
    actorId: null,
    action: 'bootstrap.provision',
    entityType: 'Organization',
    entityId: ORGANIZATION.id,
  },
  {
    id: 'aud-002',
    offsetMs: 419 * DAY_MS,
    branchId: BRANCH_HEAD_OFFICE,
    categoryId: null,
    actorId: 'usr-1001',
    action: 'branch.create',
    entityType: 'Branch',
    entityId: BRANCH_KHUJAND,
  },
  {
    id: 'aud-003',
    offsetMs: 300 * DAY_MS,
    branchId: BRANCH_KHUJAND,
    categoryId: null,
    actorId: 'usr-1001',
    action: 'user.create',
    entityType: 'User',
    entityId: 'usr-1012',
  },
  {
    id: 'aud-004',
    offsetMs: 180 * DAY_MS,
    branchId: BRANCH_BOKHTAR,
    categoryId: null,
    actorId: 'usr-1001',
    action: 'branch.create',
    entityType: 'Branch',
    entityId: BRANCH_BOKHTAR,
  },
  {
    id: 'aud-005',
    offsetMs: 90 * DAY_MS,
    branchId: BRANCH_HEAD_OFFICE,
    categoryId: 'cat-hq-csharp',
    actorId: 'usr-1011',
    action: 'category.create',
    entityType: 'Category',
    entityId: 'cat-hq-csharp',
  },
  {
    id: 'aud-006',
    offsetMs: 30 * DAY_MS,
    branchId: BRANCH_BOKHTAR,
    categoryId: 'cat-bok-frontend',
    actorId: 'usr-1001',
    action: 'category.deactivate',
    entityType: 'Category',
    entityId: 'cat-bok-frontend',
  },
  {
    id: 'aud-007',
    offsetMs: 21 * DAY_MS,
    branchId: BRANCH_KHUJAND,
    categoryId: null,
    actorId: null,
    action: 'scheduler.no_active_mentor',
    entityType: 'Category',
    entityId: 'cat-khu-design',
    result: 'Failure',
  },
  {
    id: 'aud-008',
    offsetMs: 14 * DAY_MS,
    branchId: BRANCH_HEAD_OFFICE,
    categoryId: 'cat-hq-python',
    actorId: 'usr-1002',
    action: 'assignment.force_cancel',
    entityType: 'Assignment',
    entityId: 'asn-cat-hq-python-004',
  },
  {
    id: 'aud-009',
    offsetMs: 9 * DAY_MS,
    branchId: BRANCH_KHUJAND,
    categoryId: null,
    actorId: 'usr-1012',
    action: 'notification.retry',
    entityType: 'NotificationOutbox',
    entityId: 'ntf-deadletter-alert-org',
  },
  {
    id: 'aud-010',
    offsetMs: 5 * DAY_MS,
    branchId: BRANCH_KHUJAND,
    categoryId: null,
    actorId: null,
    action: 'notification.dispatch',
    entityType: 'NotificationOutbox',
    entityId: 'ntf-category-without-lead-khu-design',
  },
  {
    id: 'aud-011',
    offsetMs: 4 * DAY_MS,
    branchId: null,
    categoryId: null,
    actorId: 'usr-1012',
    action: 'security.scope_override_rejected',
    entityType: 'Request',
    entityId: null,
    result: 'Failure',
  },
  {
    id: 'aud-012',
    offsetMs: 3 * DAY_MS,
    branchId: BRANCH_BOKHTAR,
    categoryId: null,
    actorId: null,
    action: 'branch.without_admin_detected',
    entityType: 'Branch',
    entityId: BRANCH_BOKHTAR,
  },
  {
    id: 'aud-013',
    offsetMs: 2 * DAY_MS,
    branchId: BRANCH_HEAD_OFFICE,
    categoryId: null,
    actorId: 'usr-1011',
    action: 'user.change_category',
    entityType: 'User',
    entityId: 'usr-1017',
  },
  {
    id: 'aud-014',
    offsetMs: HOUR_MS * 20,
    branchId: null,
    categoryId: null,
    actorId: 'usr-1001',
    action: 'organization.update',
    entityType: 'Organization',
    entityId: ORGANIZATION.id,
  },
  {
    id: 'aud-015',
    offsetMs: HOUR_MS * 5,
    branchId: BRANCH_HEAD_OFFICE,
    categoryId: null,
    actorId: 'usr-1011',
    action: 'audit.read',
    entityType: 'AuditLog',
    entityId: null,
  },
];

function actorRoleLabel(actorId: string | null): {
  role: UserRole | 'System';
  scope: AdminScope | null;
  label: string;
} {
  if (actorId === null) return { role: 'System', scope: null, label: 'Система' };
  const user = findUserById(actorId);
  if (user === undefined) return { role: 'System', scope: null, label: 'Неизвестный актор' };
  return { role: user.role, scope: user.adminScope, label: user.fullName };
}

function seededEntries(): AuditLogEntry[] {
  return SEED.map((entry) => {
    const actor = actorRoleLabel(entry.actorId);
    return {
      id: entry.id,
      at: MOCK_NOW - entry.offsetMs,
      organizationId: ORGANIZATION.id,
      branchId: entry.branchId,
      categoryId: entry.categoryId,
      actorId: entry.actorId,
      actorLabel: actor.label,
      actorRole: actor.role,
      actorAdminScope: actor.scope,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      result: entry.result ?? 'Success',
      correlationId: `corr-${entry.id}`,
    };
  });
}

/** Живые auth-события (login, смена пароля, reuse detection…) в едином формате. */
function liveAuthEntries(): AuditLogEntry[] {
  return db.auditEvents.map((event, index) => {
    const actor = actorRoleLabel(event.userId);
    return {
      id: `live-${String(index)}-${String(event.at)}`,
      at: event.at,
      organizationId: event.organizationId ?? ORGANIZATION.id,
      branchId: event.branchId ?? null,
      categoryId: event.categoryId ?? null,
      actorId: event.userId,
      actorLabel: event.actorRole === undefined ? actor.label : actor.label,
      actorRole: event.actorRole ?? actor.role,
      actorAdminScope: event.actorAdminScope ?? actor.scope,
      action: event.type,
      entityType: event.entityType ?? 'Session',
      entityId: event.entityId ?? event.userId,
      result: event.result ?? 'Success',
      correlationId: event.correlationId ?? `live-${String(index)}`,
    };
  });
}

export function allAuditLog(): AuditLogEntry[] {
  return [...seededEntries(), ...liveAuthEntries()].sort((a, b) => b.at - a.at);
}

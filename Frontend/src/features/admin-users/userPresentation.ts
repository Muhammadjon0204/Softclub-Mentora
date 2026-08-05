import {
  BriefcaseBusiness,
  Building2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { ComponentType, CSSProperties, SVGProps } from 'react';

import { PREVIEW_CATEGORIES, type PreviewCategory } from '../../mocks/ui-preview/categories.preview';
import type { PreviewUser, PreviewUserRole, PreviewUserStatus } from '../../mocks/ui-preview/users.preview';
import { branchDisplayName } from '../admin-preview/branchDirectory';

export { branchDisplayName } from '../admin-preview/branchDirectory';

export const NOTIFICATION_LANGUAGES = ['ru', 'tj', 'en'] as const;
export type NotificationLanguage = (typeof NOTIFICATION_LANGUAGES)[number];

export const NOTIFICATION_LANGUAGE_LABEL: Record<NotificationLanguage, string> = {
  ru: 'Русский',
  tj: 'Тоҷикӣ',
  en: 'English',
};

export type UserActivityKind =
  | 'created'
  | 'invited'
  | 'login'
  | 'role_changed'
  | 'branch_changed'
  | 'category_changed'
  | 'password_reset'
  | 'locked'
  | 'unlocked'
  | 'deactivated'
  | 'profile_updated';

export interface UserActivityEntry {
  id: string;
  kind: UserActivityKind;
  label: string;
  detail?: string;
  actorName: string;
  relativeTime: string;
  absoluteLabel: string;
}

export interface PreviewUserDetails extends PreviewUser {
  notificationLanguage: NotificationLanguage;
  invitedAtLabel: string;
  passwordSet: boolean;
  lastPasswordChangeLabel: string | null;
  activeSessions: number;
  lockReason: string | null;
  lockComment: string | null;
  deactivatedAtLabel: string | null;
  activeAssignmentsCount: number;
  activity: UserActivityEntry[];
}

function stableHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash;
}

const NO_LOGIN_LABELS = new Set(['Ещё не входил', 'Никогда']);

function buildInitialActivity(user: PreviewUser): UserActivityEntry[] {
  const entries: UserActivityEntry[] = [
    {
      id: `${user.id}-ev-created`,
      kind: 'created',
      label: 'Пользователь создан',
      actorName: 'Администратор',
      relativeTime: user.createdLabel,
      absoluteLabel: user.createdLabel,
    },
  ];

  if (user.status !== 'Deactivated') {
    entries.push({
      id: `${user.id}-ev-invited`,
      kind: 'invited',
      label: 'Приглашение отправлено',
      actorName: 'Администратор',
      relativeTime: user.createdLabel,
      absoluteLabel: user.createdLabel,
    });
  }

  if ((user.status === 'Active' || user.status === 'Locked') && !NO_LOGIN_LABELS.has(user.lastLoginLabel)) {
    entries.push({
      id: `${user.id}-ev-login`,
      kind: 'login',
      label: 'Выполнен вход',
      actorName: user.fullName,
      relativeTime: user.lastLoginLabel,
      absoluteLabel: user.lastLoginLabel,
    });
  }

  if (user.status === 'Locked') {
    entries.push({
      id: `${user.id}-ev-locked`,
      kind: 'locked',
      label: 'Пользователь заблокирован',
      detail: 'Подозрительная активность',
      actorName: 'Администратор',
      relativeTime: user.lastLoginLabel,
      absoluteLabel: user.lastLoginLabel,
    });
  }

  if (user.status === 'Deactivated') {
    entries.push({
      id: `${user.id}-ev-deactivated`,
      kind: 'deactivated',
      label: 'Пользователь деактивирован',
      actorName: 'Администратор',
      relativeTime: user.lastLoginLabel,
      absoluteLabel: user.lastLoginLabel,
    });
  }

  return entries.reverse();
}

/** Достраивает preview-пользователя данными безопасности/активности, не трогая `users.preview.ts`. */
export function enrichUser(user: PreviewUser): PreviewUserDetails {
  const hash = stableHash(user.id);
  const passwordSet = user.status !== 'Invited';
  const activeAssignmentsCount =
    user.role === 'Mentor' && (user.status === 'Active' || user.status === 'Locked') ? hash % 4 : 0;

  return {
    ...user,
    notificationLanguage: 'ru',
    invitedAtLabel: user.createdLabel,
    passwordSet,
    lastPasswordChangeLabel: passwordSet ? user.createdLabel : null,
    activeSessions: user.status === 'Active' ? 1 + (hash % 2) : 0,
    lockReason: user.status === 'Locked' ? 'Подозрительная активность' : null,
    lockComment: null,
    deactivatedAtLabel: user.status === 'Deactivated' ? user.lastLoginLabel : null,
    activeAssignmentsCount,
    activity: buildInitialActivity(user),
  };
}

export const ROLE_ICON: Record<PreviewUserRole, ComponentType<SVGProps<SVGSVGElement>>> = {
  OrgAdmin: ShieldCheck,
  BranchAdmin: Building2,
  Lead: BriefcaseBusiness,
  Mentor: UserRound,
};

export const ROLE_TONE: Record<PreviewUserRole, { className: string; style?: CSSProperties }> = {
  OrgAdmin: { className: 'bg-brand-soft text-brand' },
  BranchAdmin: { className: 'bg-info-soft text-info' },
  Lead: {
    className: 'text-[var(--secondary-cyan)]',
    style: { backgroundColor: 'color-mix(in srgb, var(--secondary-cyan) 15%, transparent)' },
  },
  Mentor: { className: 'bg-surface-muted text-ink-secondary' },
};

export const STATUS_META: Record<PreviewUserStatus, { dot: string; text: string }> = {
  Active: { dot: 'bg-success', text: 'text-success' },
  Invited: { dot: 'bg-info', text: 'text-info' },
  Locked: { dot: 'bg-warning', text: 'text-warning' },
  Deactivated: { dot: 'bg-ink-disabled', text: 'text-ink-muted' },
};

/** Компактный список из 3–5 пунктов (раздел 8 промпта) — не полноценная permission matrix. */
export function accessSummaryFor(role: PreviewUserRole): string[] {
  switch (role) {
    case 'OrgAdmin':
      return ['Управляет филиалами', 'Управляет пользователями', 'Видит данные всей организации', 'Не выполняет review заданий'];
    case 'BranchAdmin':
      return ['Управляет пользователями своего филиала', 'Видит данные только своего филиала', 'Не управляет другими филиалами'];
    case 'Lead':
      return ['Создаёт и проверяет задания своего направления', 'Видит менторов своего направления'];
    case 'Mentor':
    default:
      return ['Выполняет назначенные задания', 'Видит только собственные submissions'];
  }
}

export function accessScopeFor(user: Pick<PreviewUser, 'role' | 'branchName' | 'categoryName'>): { primary: string; secondary?: string } {
  if (user.role === 'OrgAdmin') return { primary: 'Вся организация', secondary: 'Все филиалы' };
  if (user.role === 'BranchAdmin') return { primary: branchDisplayName(user.branchName), secondary: 'Администрирование' };
  return { primary: branchDisplayName(user.branchName), secondary: user.categoryName ?? undefined };
}

/** Роли, которые вправе назначать Organization Admin / Branch Admin при создании пользователя (раздел 3 промпта). */
export function assignableRolesFor(scope: 'Organization' | 'Branch'): Exclude<PreviewUserRole, 'OrgAdmin'>[] {
  return scope === 'Organization' ? ['BranchAdmin', 'Lead', 'Mentor'] : ['Lead', 'Mentor'];
}

export function activeCategoriesForBranch(branchRawName: string): PreviewCategory[] {
  return PREVIEW_CATEGORIES.filter((category) => category.branchName === branchRawName && category.isActive);
}

export function emptyOrValue(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim().length === 0 ? 'Не назначено' : value;
}

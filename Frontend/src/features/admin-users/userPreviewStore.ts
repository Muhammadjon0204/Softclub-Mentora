import { useSyncExternalStore } from 'react';

import { PREVIEW_USERS, ROLE_LABEL, type PreviewUser, type PreviewUserRole } from '../../mocks/ui-preview/users.preview';
import { branchDisplayName } from '../admin-preview/branchDirectory';
import { enrichUser, type NotificationLanguage, type PreviewUserDetails, type UserActivityEntry } from './userPresentation';

/**
 * Module-level preview store для Users: immutable-мутации + `useSyncExternalStore`,
 * без localStorage (раздел 38 промпта) — живёт только в памяти вкладки, как и
 * остальной stage-1 mock-слой. Не задевает `users.preview.ts` — тот остаётся
 * исходным неизменяемым seed-набором, стор строит из него обогащённую копию один раз.
 */
let users: PreviewUserDetails[] = PREVIEW_USERS.map(enrichUser);
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PreviewUserDetails[] {
  return users;
}

export function useUsersPreview(): PreviewUserDetails[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function getUserPreview(id: string): PreviewUserDetails | undefined {
  return users.find((user) => user.id === id);
}

let nextSeq = users.length + 1;
function nextUserId(): string {
  const id = `usr-new-${nextSeq}`;
  nextSeq += 1;
  return id;
}

export class UserPreviewError extends Error {}

function withActivity(user: PreviewUserDetails, entry: Omit<UserActivityEntry, 'id'>): PreviewUserDetails {
  const stampedEntry: UserActivityEntry = { ...entry, id: `${user.id}-ev-${user.activity.length + 1}-${entry.kind}` };
  return { ...user, activity: [stampedEntry, ...user.activity] };
}

function patchUser(id: string, patcher: (user: PreviewUserDetails) => PreviewUserDetails): PreviewUserDetails {
  const existing = users.find((user) => user.id === id);
  if (existing === undefined) throw new UserPreviewError('Пользователь не найден');

  let updated: PreviewUserDetails = existing;
  users = users.map((user) => {
    if (user.id !== id) return user;
    updated = patcher(user);
    return updated;
  });
  emit();
  return updated;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  role: Exclude<PreviewUserRole, 'OrgAdmin'>;
  branchName: string;
  categoryName: string | null;
  notificationLanguage: NotificationLanguage;
  sendInvitationNow: boolean;
}

/** Email глобально уникален во всей организации (раздел 3 промпта) — проверка перед созданием. */
export function createUserPreview(input: CreateUserInput): PreviewUserDetails {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new UserPreviewError('Пользователь с таким email уже существует');
  }

  const id = nextUserId();
  const today = 'Сегодня';
  const base: PreviewUser = {
    id,
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    role: input.role,
    branchName: input.branchName,
    categoryName: input.categoryName,
    status: 'Invited',
    lastLoginLabel: 'Ещё не входил',
    createdLabel: today,
  };

  const activity: UserActivityEntry[] = [
    { id: `${id}-ev-created`, kind: 'created', label: 'Пользователь создан', actorName: 'Вы', relativeTime: today, absoluteLabel: today },
  ];
  if (input.sendInvitationNow) {
    activity.unshift({
      id: `${id}-ev-invited`,
      kind: 'invited',
      label: 'Приглашение отправлено',
      actorName: 'Вы',
      relativeTime: today,
      absoluteLabel: today,
    });
  }

  const created: PreviewUserDetails = {
    ...enrichUser(base),
    notificationLanguage: input.notificationLanguage,
    invitedAtLabel: input.sendInvitationNow ? today : base.createdLabel,
    activity,
  };

  users = [created, ...users];
  emit();
  return created;
}

export interface UpdateUserInput {
  fullName: string;
  notificationLanguage: NotificationLanguage;
}

export function updateUserPreview(id: string, input: UpdateUserInput): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(
      { ...user, fullName: input.fullName.trim(), notificationLanguage: input.notificationLanguage },
      { kind: 'profile_updated', label: 'Изменены данные профиля', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}

export interface ChangeUserRoleInput {
  role: Exclude<PreviewUserRole, 'OrgAdmin'>;
  branchName: string;
  categoryName: string | null;
}

export function changeUserRolePreview(id: string, input: ChangeUserRoleInput): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(
      { ...user, role: input.role, branchName: input.branchName, categoryName: input.categoryName },
      {
        kind: 'role_changed',
        label: 'Изменена роль',
        detail: `${ROLE_LABEL[user.role]} → ${ROLE_LABEL[input.role]}`,
        actorName: 'Вы',
        relativeTime: 'Сейчас',
        absoluteLabel: 'Сейчас',
      },
    ),
  );
}

export interface TransferUserInput {
  branchName: string;
  categoryName: string | null;
}

export function transferUserPreview(id: string, input: TransferUserInput): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(
      { ...user, branchName: input.branchName, categoryName: input.categoryName },
      {
        kind: 'branch_changed',
        label: 'Пользователь переведён в другой филиал',
        detail: `${branchDisplayName(user.branchName)} → ${branchDisplayName(input.branchName)}`,
        actorName: 'Вы',
        relativeTime: 'Сейчас',
        absoluteLabel: 'Сейчас',
      },
    ),
  );
}

export function resendInvitationPreview(id: string): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(
      { ...user, invitedAtLabel: 'Сейчас' },
      { kind: 'invited', label: 'Приглашение отправлено повторно', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}

export function requestPasswordResetPreview(id: string): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(user, {
      kind: 'password_reset',
      label: 'Отправлена ссылка сброса пароля',
      actorName: 'Вы',
      relativeTime: 'Сейчас',
      absoluteLabel: 'Сейчас',
    }),
  );
}

export interface BlockUserInput {
  reason: string;
  comment: string | null;
}

export function blockUserPreview(id: string, input: BlockUserInput): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(
      { ...user, status: 'Locked', lockReason: input.reason, lockComment: input.comment, activeSessions: 0 },
      { kind: 'locked', label: 'Пользователь заблокирован', detail: input.reason, actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}

export function unblockUserPreview(id: string): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(
      { ...user, status: 'Active', lockReason: null, lockComment: null },
      { kind: 'unlocked', label: 'Пользователь разблокирован', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}

export function deactivateUserPreview(id: string): PreviewUserDetails {
  return patchUser(id, (user) =>
    withActivity(
      { ...user, status: 'Deactivated', deactivatedAtLabel: 'Сегодня', activeSessions: 0 },
      { kind: 'deactivated', label: 'Пользователь деактивирован', actorName: 'Вы', relativeTime: 'Сегодня', absoluteLabel: 'Сегодня' },
    ),
  );
}

import { useEffect, useState } from 'react';

import { Drawer } from '../../shared/overlays';
import { ErrorState } from '../../shared/ui/ErrorState';
import { UserAccessSection } from './UserAccessSection';
import { UserActionMenu } from './UserActionMenu';
import { UserActivitySection } from './UserActivitySection';
import { UserOverviewSection } from './UserOverviewSection';
import { UserSecuritySection } from './UserSecuritySection';
import { STATUS_META } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';
import { STATUS_LABEL } from '../../mocks/ui-preview/users.preview';

type UserDetailsTab = 'overview' | 'access' | 'security' | 'activity';

const TABS: { id: UserDetailsTab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'access', label: 'Доступ' },
  { id: 'security', label: 'Безопасность' },
  { id: 'activity', label: 'Активность' },
];

export interface UserDetailsDrawerProps {
  userId: string | null;
  /**
   * Уже scope-отфильтрованный список (branch/all в зависимости от adminScope
   * вызывающей страницы) — НЕ полный store. Так чужой Branch неотличим от
   * несуществующего пользователя: тот же `ErrorState` ниже (ADR-001, раздел 2.8).
   */
  users: PreviewUserDetails[];
  onClose: () => void;
  isOrgAdmin: boolean;
  /** id вошедшего администратора — сравнивается с `user.id`, чтобы скрыть опасные действия на себе. */
  currentUserId: string | null;
  onEdit: (user: PreviewUserDetails) => void;
  onActivate: (user: PreviewUserDetails) => void;
  onChangeRole: (user: PreviewUserDetails) => void;
  onTransfer: (user: PreviewUserDetails) => void;
  onResendInvitation: (user: PreviewUserDetails) => void;
  onRequestPasswordReset: (user: PreviewUserDetails) => void;
  onBlock: (user: PreviewUserDetails) => void;
  onUnblock: (user: PreviewUserDetails) => void;
  onDeactivate: (user: PreviewUserDetails) => void;
}

/**
 * Открывается по клику на строку (не по `…`, раздел 6 промпта). Ищет
 * пользователя в уже scope-отфильтрованном списке страницы (`users` prop,
 * подписанном на `userPreviewStore`) — после любой mutation (смена роли,
 * блокировка…) drawer обновляется сам, без ручного refetch.
 */
export function UserDetailsDrawer({
  userId,
  users,
  onClose,
  isOrgAdmin,
  currentUserId,
  onEdit,
  onActivate,
  onChangeRole,
  onTransfer,
  onResendInvitation,
  onRequestPasswordReset,
  onBlock,
  onUnblock,
  onDeactivate,
}: UserDetailsDrawerProps): JSX.Element {
  const user = userId !== null ? users.find((candidate) => candidate.id === userId) : undefined;
  const isSelf = user !== undefined && user.id === currentUserId;
  const [tab, setTab] = useState<UserDetailsTab>('overview');

  useEffect(() => {
    if (userId !== null) setTab('overview');
  }, [userId]);

  const open = userId !== null;
  const statusMeta = user !== undefined ? STATUS_META[user.status] : null;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={user?.fullName ?? 'Пользователь'}
      description={user?.email}
      size="lg"
      headerActions={
        user !== undefined && statusMeta !== null ? (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium" role="status" aria-label={`Статус: ${STATUS_LABEL[user.status]}`}>
              <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${statusMeta.dot}`} />
              <span className={statusMeta.text}>{STATUS_LABEL[user.status]}</span>
            </span>
            <UserActionMenu
              user={user}
              context="drawer"
              isOrgAdmin={isOrgAdmin}
              isSelf={isSelf}
              onEdit={() => onEdit(user)}
              onActivate={() => onActivate(user)}
              onChangeRole={() => onChangeRole(user)}
              onTransfer={() => onTransfer(user)}
              onResendInvitation={() => onResendInvitation(user)}
              onRequestPasswordReset={() => onRequestPasswordReset(user)}
              onBlock={() => onBlock(user)}
              onUnblock={() => onUnblock(user)}
              onDeactivate={() => onDeactivate(user)}
            />
          </div>
        ) : undefined
      }
    >
      {userId === null ? null : user === undefined ? (
        <ErrorState title="Пользователь не найден" error={null} />
      ) : (
        <div className="space-y-5">
          <div role="tablist" aria-label="Разделы профиля пользователя" className="flex gap-1 rounded-control bg-surface-muted p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                }}
                className={`h-8 flex-1 rounded-control-sm text-[12.5px] font-medium transition ${
                  tab === item.id ? 'bg-surface text-ink shadow-surface' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'overview' ? <UserOverviewSection user={user} /> : null}
            {tab === 'access' ? <UserAccessSection user={user} /> : null}
            {tab === 'security' ? (
              <UserSecuritySection
                user={user}
                isSelf={isSelf}
                onActivate={() => onActivate(user)}
                onResendInvitation={() => onResendInvitation(user)}
                onRequestPasswordReset={() => onRequestPasswordReset(user)}
                onBlock={() => onBlock(user)}
                onUnblock={() => onUnblock(user)}
                onDeactivate={() => onDeactivate(user)}
              />
            ) : null}
            {tab === 'activity' ? <UserActivitySection user={user} /> : null}
          </div>
        </div>
      )}
    </Drawer>
  );
}

import { useQuery } from '@tanstack/react-query';
import { KeyRound, Lock, Mail, ShieldOff, UserCheck, UserX } from 'lucide-react';
import type { ReactNode } from 'react';

import { listNotifications } from '../../api/admin/notifications';
import { STATUS_LABEL } from '../../mocks/ui-preview/users.preview';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { emptyOrValue } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';

function SecurityRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}

const INVITATION_STATUS_LABEL: Record<string, string> = {
  Pending: 'В очереди на отправку',
  Processing: 'Отправляется',
  Sent: 'Письмо отправлено',
  DeadLetter: 'Не удалось отправить',
};

const INVITATION_STATUS_TONE: Record<string, BadgeTone> = {
  Pending: 'neutral',
  Processing: 'info',
  Sent: 'success',
  DeadLetter: 'danger',
};

/**
 * Показывает реальный статус доставки последнего письма-приглашения (очередь
 * `notification_outbox`, `GET /admin/notifications?userId=…&eventType=UserInvitation`),
 * а не факт создания аккаунта — раньше карточка пользователя вообще не отличала
 * «письмо ушло» от «письмо всё ещё в очереди» или «доставка провалилась».
 */
function InvitationDeliveryRow({ userId }: { userId: string }): JSX.Element {
  const query = useQuery({
    queryKey: ['user-invitation-notification', userId],
    queryFn: async () => listNotifications({ userId, eventType: 'UserInvitation', page: 1, pageSize: 1 }),
  });

  const latest = query.data?.items[0];

  return (
    <SecurityRow
      label="Доставка письма"
      value={
        query.isPending ? (
          <span className="text-ink-muted">Проверка…</span>
        ) : query.error !== null ? (
          <span className="text-danger">Не удалось проверить</span>
        ) : latest === undefined ? (
          <span className="text-ink-muted">Нет данных</span>
        ) : (
          <Badge tone={INVITATION_STATUS_TONE[latest.status] ?? 'neutral'}>
            {INVITATION_STATUS_LABEL[latest.status] ?? latest.status}
          </Badge>
        )
      }
    />
  );
}

export interface UserSecuritySectionProps {
  user: PreviewUserDetails;
  /** `true`, если `user` — это сам вошедший администратор. */
  isSelf: boolean;
  onActivate: () => void;
  onResendInvitation: () => void;
  onRequestPasswordReset: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onDeactivate: () => void;
}

/**
 * Security-раздел: только человекочитаемые поля (раздел 9 промпта) — никаких
 * PasswordHash/token/TokenVersion. Действия показываются согласно статусу, тем
 * же набором условий, что и `UserActionMenu`.
 */
export function UserSecuritySection({
  user,
  isSelf,
  onActivate,
  onResendInvitation,
  onRequestPasswordReset,
  onBlock,
  onUnblock,
  onDeactivate,
}: UserSecuritySectionProps): JSX.Element {
  const isDeactivated = user.status === 'Deactivated';

  return (
    <div className="space-y-5">
      <dl className="divide-y divide-divider">
        <SecurityRow label="Статус приглашения" value={user.passwordSet ? 'Принято' : 'Ожидает установки пароля'} />
        {!user.passwordSet && user.status === 'Invited' ? <InvitationDeliveryRow userId={user.id} /> : null}
        <SecurityRow label="Пароль установлен" value={user.passwordSet ? 'Да' : 'Нет'} />
        <SecurityRow label="Последняя смена пароля" value={emptyOrValue(user.lastPasswordChangeLabel)} />
        <SecurityRow label="Активные сессии" value={String(user.activeSessions)} />
        <SecurityRow
          label="Последний вход"
          value={emptyOrValue(user.lastLoginLabel === 'Ещё не входил' || user.lastLoginLabel === 'Никогда' ? null : user.lastLoginLabel)}
        />
        {user.status === 'Locked' ? <SecurityRow label="Причина блокировки" value={emptyOrValue(user.lockReason)} /> : null}
        {isDeactivated ? <SecurityRow label="Дата деактивации" value={emptyOrValue(user.deactivatedAtLabel)} /> : null}
      </dl>

      {isSelf ? (
        <p className="rounded-control-sm border border-line bg-surface-muted px-3 py-2.5 text-[12.5px] text-ink-muted">
          Это ваша учётная запись — блокировка, деактивация и смена роли самому себе недоступны.
        </p>
      ) : (
        <div>
          <h4 className="mb-2.5 text-[12.5px] font-semibold text-ink-secondary">Действия</h4>
          <div className="flex flex-col gap-2">
            {isDeactivated ? (
              <Button variant="secondary" size="sm" leadingIcon={<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onActivate}>
                Активировать
              </Button>
            ) : null}
            {!user.passwordSet && user.status === 'Invited' ? (
              <Button variant="secondary" size="sm" leadingIcon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onResendInvitation}>
                Повторно отправить приглашение
              </Button>
            ) : null}
            {user.passwordSet && !isDeactivated ? (
              <Button variant="secondary" size="sm" leadingIcon={<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onRequestPasswordReset}>
                Отправить ссылку сброса пароля
              </Button>
            ) : null}
            {user.status === 'Active' ? (
              <Button variant="secondary" size="sm" leadingIcon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onBlock}>
                Заблокировать
              </Button>
            ) : null}
            {user.status === 'Locked' ? (
              <Button variant="secondary" size="sm" leadingIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onUnblock}>
                Разблокировать
              </Button>
            ) : null}
            {!isDeactivated ? (
              <Button variant="danger" size="sm" leadingIcon={<UserX className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onDeactivate}>
                Деактивировать
              </Button>
            ) : (
              <p className="rounded-control-sm border border-line bg-surface-muted px-3 py-2.5 text-[12.5px] text-ink-muted">
                Статус: {STATUS_LABEL.Deactivated} — остальные действия недоступны.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

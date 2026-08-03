import { ScrollText } from 'lucide-react';

import type { AuditLogEntryDto } from '../../api/admin/dashboard';
import { Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';

interface RecentActivityListProps {
  entries: AuditLogEntryDto[];
}

const ACTION_LABEL: Record<string, string> = {
  'bootstrap.provision': 'Провижининг организации',
  'branch.create': 'Создан филиал',
  'branch.deactivate': 'Филиал деактивирован',
  'branch.without_admin_detected': 'Филиал остался без администратора',
  'user.create': 'Создан пользователь',
  'user.change_category': 'Изменена категория пользователя',
  'category.create': 'Создана категория',
  'category.deactivate': 'Категория деактивирована',
  'scheduler.no_active_mentor': 'Планировщик: нет активных менторов',
  'assignment.force_cancel': 'Принудительная отмена задания',
  'notification.retry': 'Повторная отправка уведомления',
  'notification.dispatch': 'Отправлено уведомление',
  'security.scope_override_rejected': 'Отклонена попытка подмены scope',
  'organization.update': 'Обновлён профиль организации',
  'audit.read': 'Просмотрен журнал аудита',
  login_success: 'Успешный вход',
  logout: 'Выход из системы',
};

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

function relativeLabel(iso: string, nowMs: number): string {
  const diffMs = new Date(iso).getTime() - nowMs;
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 60) return RELATIVE_FORMATTER.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return RELATIVE_FORMATTER.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_FORMATTER.format(diffDays, 'day');
}

export function RecentActivityList({ entries }: RecentActivityListProps): JSX.Element {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
        title="Пока нет записей"
        description="Действия администраторов и системные события появятся здесь."
      />
    );
  }

  const now = Date.now();

  return (
    <ul className="divide-y divide-divider">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${entry.result === 'Failure' ? 'bg-danger' : 'bg-success'}`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">
              <span className="font-medium">{entry.actorLabel}</span>{' '}
              <span className="text-ink-secondary">{ACTION_LABEL[entry.action] ?? entry.action}</span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {entry.entityType} · {relativeLabel(entry.at, now)}
            </p>
          </div>
          {entry.result === 'Failure' ? <Badge tone="danger">Ошибка</Badge> : null}
        </li>
      ))}
    </ul>
  );
}

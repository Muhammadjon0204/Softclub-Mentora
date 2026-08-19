import { BellOff, CheckCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTabs } from '../../features/admin-preview/PreviewTabs';
import { NOTIFICATION_CATEGORY_ICON, NOTIFICATION_CATEGORY_LABEL, NOTIFICATION_CATEGORY_TONE } from '../../features/mentor-notifications/notificationPresentation';
import { useMentorNotifications } from '../../features/mentor-notifications/useMentorNotifications';
import type { MentorNotificationCategory } from '../../features/mentor-notifications/mentorNotificationSource';
import { formatRelative } from '../../features/mentor/scope/mentorDateFormat';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';

const CATEGORY_TABS: { key: 'all' | MentorNotificationCategory; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'submissions', label: NOTIFICATION_CATEGORY_LABEL.submissions },
  { key: 'assignments', label: NOTIFICATION_CATEGORY_LABEL.assignments },
  { key: 'feedback', label: NOTIFICATION_CATEGORY_LABEL.feedback },
  { key: 'system', label: NOTIFICATION_CATEGORY_LABEL.system },
];

/**
 * `/mentor/notifications` — производная лента поверх событий заданий и
 * занятий собственного scope (раздел 20 задачи), не копия delivery-статуса
 * Email/Telegram Admin-раздела — другой домен и другая аудитория.
 */
export function NotificationsPage(): JSX.Element {
  const navigate = useNavigate();
  const { all, unreadCount, isRead, markRead, markAllRead } = useMentorNotifications();
  const [tab, setTab] = useState<'all' | MentorNotificationCategory>('all');

  const rows = useMemo(() => (tab === 'all' ? all : all.filter((n) => n.category === tab)), [all, tab]);

  function openNotification(id: string, targetPath: string): void {
    markRead(id);
    navigate(targetPath);
  }

  return (
    <div className="space-y-5">
      <PreviewPageHeader
        title="Уведомления"
        subtitle={unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все уведомления прочитаны'}
        action={
          unreadCount > 0 ? (
            <Button variant="secondary" leadingIcon={<CheckCheck className="h-4 w-4" aria-hidden="true" />} onClick={markAllRead}>
              Прочитать всё
            </Button>
          ) : undefined
        }
      />

      <Card padded={false} className="min-w-0">
        {all.length > 0 ? (
          <div className="border-b border-divider px-5 pt-4 sm:px-6">
            <PreviewTabs tabs={CATEGORY_TABS} active={tab} onChange={(key) => { setTab(key as 'all' | MentorNotificationCategory); }} />
          </div>
        ) : null}

        {all.length === 0 ? (
          <EmptyState icon={<BellOff className="h-5 w-5" aria-hidden="true" />} title="Всё спокойно" description="Новых уведомлений нет." />
        ) : rows.length === 0 ? (
          <EmptyState icon={<BellOff className="h-5 w-5" aria-hidden="true" />} title="Ничего не найдено" description="В этой категории уведомлений пока нет." />
        ) : (
          <ul className="divide-y divide-divider">
            {rows.map((n) => {
              const Icon = NOTIFICATION_CATEGORY_ICON[n.category];
              const unread = !isRead(n.id);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => { openNotification(n.id, n.targetPath); }}
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${NOTIFICATION_CATEGORY_TONE[n.category]}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {unread ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /> : null}
                        <p className={`truncate text-[13.5px] leading-5 ${unread ? 'font-semibold text-ink' : 'font-medium text-ink-secondary'}`}>{n.title}</p>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-ink-muted" title={n.description}>{n.description}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[11.5px] text-ink-disabled">{formatRelative(n.occurredAt).label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

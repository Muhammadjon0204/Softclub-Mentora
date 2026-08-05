import { Bell } from 'lucide-react';

import { NOTIFICATION_STATUS_LABEL } from '../../mocks/ui-preview/notifications.preview';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { RelatedNotificationEntry } from './assignmentPresentation';

const STATUS_TONE: Record<RelatedNotificationEntry['status'], BadgeTone> = {
  Pending: 'neutral',
  Processing: 'info',
  Sent: 'success',
  DeadLetter: 'warning',
};

export function AssignmentNotificationsSection({ notifications }: { notifications: RelatedNotificationEntry[] }): JSX.Element {
  if (notifications.length === 0) {
    return <EmptyState icon={<Bell className="h-5 w-5" aria-hidden="true" />} title="Уведомлений нет" description="Связанные уведомления появятся здесь по мере событий задания." />;
  }

  return (
    <ul className="divide-y divide-divider rounded-control border border-line">
      {notifications.map((notification) => (
        <li key={notification.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">{notification.eventLabel}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-muted">{notification.channel} · {notification.sentLabel}</p>
          </div>
          <Badge tone={STATUS_TONE[notification.status]}>{NOTIFICATION_STATUS_LABEL[notification.status]}</Badge>
        </li>
      ))}
    </ul>
  );
}

import { Copy, Eye, MoreHorizontal, RotateCw } from 'lucide-react';

import { ActionMenu } from '../../shared/overlays';
import type { ActionMenuItem } from '../../shared/overlays';
import { IconButton } from '../../shared/ui/Button';
import { canRetryNotification } from './notificationPresentation';
import type { PreviewNotificationDetails } from './notificationPresentation';

export interface NotificationActionMenuProps {
  notification: PreviewNotificationDetails;
  context: 'row' | 'drawer';
  onOpenDetails?: () => void;
  onRetry: () => void;
  onCopyCorrelationId: () => void;
}

/** Раздел 40 промпта: Открыть; Повторить отправку (если разрешено статусом); Скопировать Correlation ID. */
export function NotificationActionMenu({ notification, context, onOpenDetails, onRetry, onCopyCorrelationId }: NotificationActionMenuProps): JSX.Element {
  const items: ActionMenuItem[] = [];

  if (context === 'row' && onOpenDetails !== undefined) {
    items.push({ id: 'open', label: 'Открыть', icon: <Eye className="h-full w-full" aria-hidden="true" />, onSelect: onOpenDetails });
  }

  if (canRetryNotification(notification.status)) {
    items.push({ id: 'retry', label: 'Повторить отправку', icon: <RotateCw className="h-full w-full" aria-hidden="true" />, onSelect: onRetry });
  }

  items.push({ id: 'copy-id', label: 'Скопировать Correlation ID', icon: <Copy className="h-full w-full" aria-hidden="true" />, separatorBefore: true, onSelect: onCopyCorrelationId });

  return (
    <ActionMenu
      align="end"
      ariaLabel={`Действия: ${notification.eventLabel}`}
      panelClassName="w-64"
      trigger={
        <IconButton label={`Действия: ${notification.eventLabel}`} size="sm">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      }
      items={items}
    />
  );
}

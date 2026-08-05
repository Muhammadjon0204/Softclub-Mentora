import { Modal } from '../../shared/overlays';
import type { PreviewNotificationDetails } from './notificationPresentation';

export interface NotificationPayloadModalProps {
  notification: PreviewNotificationDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Только безопасные key-value поля (раздел 21/22 промпта) — не raw JSON dump, без секретов провайдера. */
export function NotificationPayloadModal({ notification, open, onOpenChange }: NotificationPayloadModalProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Payload уведомления" size="sm" ariaLabel="Payload уведомления">
      {notification !== null ? (
        <dl className="divide-y divide-divider">
          {notification.payload.map((entry) => (
            <div key={entry.label} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <dt className="shrink-0 text-ink-muted">{entry.label}</dt>
              <dd className="min-w-0 truncate text-right font-medium text-ink">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Modal>
  );
}

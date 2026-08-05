import { ConfirmDialog } from '../../shared/overlays';
import type { PreviewNotificationDetails } from './notificationPresentation';

export interface RetryNotificationDialogProps {
  notification: PreviewNotificationDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

/** Только для допустимых состояний (раздел 23 промпта) — видимость решает вызывающий ActionMenu. */
export function RetryNotificationDialog({ notification, open, onOpenChange, isSubmitting, onConfirm }: RetryNotificationDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Повторить отправку уведомления?"
      description="Повторная отправка создаст новую попытку доставки. История предыдущих попыток сохранится."
      details={
        notification !== null ? (
          <div className="space-y-2 rounded-control border border-line bg-surface-muted p-3 text-[12.5px]">
            <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Получатель</span><span className="font-medium text-ink">{notification.recipientName}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Канал</span><span className="font-medium text-ink">{notification.channel}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Попыток</span><span className="font-medium text-ink">{notification.attempts}</span></div>
            {notification.errorSummary !== null ? (
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Последняя ошибка</span><span className="max-w-[220px] truncate text-right font-medium text-danger" title={notification.errorSummary}>{notification.errorSummary}</span></div>
            ) : null}
          </div>
        ) : undefined
      }
      confirmLabel="Повторить отправку"
      loading={isSubmitting}
      onConfirm={async () => {
        if (notification === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}

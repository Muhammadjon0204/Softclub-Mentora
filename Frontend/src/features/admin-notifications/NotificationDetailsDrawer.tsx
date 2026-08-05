import { Copy, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

import { NOTIFICATION_STATUS_LABEL, type PreviewNotificationStatus } from '../../mocks/ui-preview/notifications.preview';
import { Drawer } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ErrorState } from '../../shared/ui/ErrorState';
import { EmptyState } from '../../shared/ui/EmptyState';
import { NotificationActionMenu } from './NotificationActionMenu';
import { NotificationPayloadModal } from './NotificationPayloadModal';
import { branchDisplayName, canRetryNotification } from './notificationPresentation';
import type { DeliveryAttemptEntry, PreviewNotificationDetails } from './notificationPresentation';

type NotificationDetailsTab = 'overview' | 'delivery' | 'error' | 'technical';

const TABS: { id: NotificationDetailsTab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'delivery', label: 'Доставка' },
  { id: 'error', label: 'Ошибка' },
  { id: 'technical', label: 'Технические данные' },
];

const STATUS_TONE: Record<PreviewNotificationStatus, BadgeTone> = {
  Pending: 'neutral',
  Processing: 'info',
  Sent: 'success',
  DeadLetter: 'warning',
};

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}

const OUTCOME_LABEL: Record<DeliveryAttemptEntry['outcome'], string> = { sent: 'Отправлено', failed: 'Ошибка', pending: 'В процессе' };
const OUTCOME_TONE: Record<DeliveryAttemptEntry['outcome'], BadgeTone> = { sent: 'success', failed: 'warning', pending: 'info' };

export interface NotificationDetailsDrawerProps {
  notificationId: string | null;
  notification: PreviewNotificationDetails | undefined;
  onClose: () => void;
  onRetry: (notification: PreviewNotificationDetails) => void;
}

/** Технические данные доступны только Admin и безопасно отформатированы (раздел 21/22 промпта) — без секретов провайдера. */
export function NotificationDetailsDrawer({ notificationId, notification, onClose, onRetry }: NotificationDetailsDrawerProps): JSX.Element {
  const [tab, setTab] = useState<NotificationDetailsTab>('overview');
  const [payloadOpen, setPayloadOpen] = useState(false);

  useEffect(() => {
    if (notificationId !== null) setTab('overview');
  }, [notificationId]);

  const open = notificationId !== null;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={notification?.eventLabel ?? 'Уведомление'}
        description={notification !== undefined ? `${notification.recipientName} · ${notification.channel}` : undefined}
        size="lg"
        headerActions={
          notification !== undefined ? (
            <div className="flex items-center gap-1.5">
              <Badge tone={STATUS_TONE[notification.status]}>{NOTIFICATION_STATUS_LABEL[notification.status]}</Badge>
              <NotificationActionMenu
                notification={notification}
                context="drawer"
                onRetry={() => { onRetry(notification); }}
                onCopyCorrelationId={() => { void navigator.clipboard.writeText(notification.correlationId); }}
              />
            </div>
          ) : undefined
        }
      >
        {notificationId === null ? null : notification === undefined ? (
          <ErrorState title="Уведомление не найдено" error={null} />
        ) : (
          <div className="space-y-5">
            <div role="tablist" aria-label="Разделы уведомления" className="flex gap-1 overflow-x-auto rounded-control bg-surface-muted p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => { setTab(item.id); }}
                  className={`h-8 shrink-0 rounded-control-sm px-2.5 text-[12.5px] font-medium transition ${tab === item.id ? 'bg-surface text-ink shadow-surface' : 'text-ink-muted hover:text-ink'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {tab === 'overview' ? (
                <dl className="divide-y divide-divider">
                  <DetailRow label="Событие" value={notification.eventLabel} />
                  <DetailRow label="Получатель" value={notification.recipientName} />
                  <DetailRow label="Контакт" value={notification.recipientContact} />
                  <DetailRow label="Канал" value={notification.channel} />
                  <DetailRow label="Филиал" value={branchDisplayName(notification.branchName)} />
                  <DetailRow label="Статус" value={NOTIFICATION_STATUS_LABEL[notification.status]} />
                  <DetailRow label="Попыток" value={String(notification.attempts)} />
                  <DetailRow label="Создано" value={notification.createdLabel} />
                  {notification.processedAtLabel !== null ? <DetailRow label="Обработано" value={notification.processedAtLabel} /> : null}
                  {notification.sentAtLabel !== null ? <DetailRow label="Отправлено" value={notification.sentAtLabel} /> : null}
                  {notification.nextRetryLabel !== null ? <DetailRow label="Следующая попытка" value={notification.nextRetryLabel} /> : null}
                </dl>
              ) : null}

              {tab === 'delivery' ? (
                notification.deliveryAttempts.length === 0 ? (
                  <EmptyState icon={<Eye className="h-5 w-5" aria-hidden="true" />} title="Попыток пока не было" description="Уведомление ещё в очереди." />
                ) : (
                  <ol className="space-y-3">
                    {notification.deliveryAttempts.map((attempt) => (
                      <li key={attempt.id} className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface p-3">
                        <div>
                          <p className="text-[13px] font-medium text-ink">Попытка {attempt.attemptNumber}</p>
                          <p className="text-[11.5px] text-ink-muted">{attempt.atLabel}</p>
                        </div>
                        <Badge tone={OUTCOME_TONE[attempt.outcome]}>{OUTCOME_LABEL[attempt.outcome]}</Badge>
                      </li>
                    ))}
                  </ol>
                )
              ) : null}

              {tab === 'error' ? (
                notification.errorSummary === null ? (
                  <EmptyState icon={<Eye className="h-5 w-5" aria-hidden="true" />} title="Ошибок не зафиксировано" description="Последняя попытка доставки прошла без ошибок." />
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-control border border-warning-border bg-warning-soft px-3.5 py-3 text-[13px] leading-[19px] text-warning">{notification.errorSummary}</p>
                    {canRetryNotification(notification.status) ? (
                      <Button variant="secondary" size="sm" onClick={() => { onRetry(notification); }}>
                        Повторить отправку
                      </Button>
                    ) : null}
                  </div>
                )
              ) : null}

              {tab === 'technical' ? (
                <div className="space-y-4">
                  <dl className="divide-y divide-divider">
                    <DetailRow label="Correlation ID" value={notification.correlationId} />
                  </dl>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => { void navigator.clipboard.writeText(notification.correlationId); }}
                  >
                    Скопировать Correlation ID
                  </Button>
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => { setPayloadOpen(true); }}>
                      Просмотреть payload
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Drawer>

      <NotificationPayloadModal notification={notification ?? null} open={payloadOpen} onOpenChange={setPayloadOpen} />
    </>
  );
}

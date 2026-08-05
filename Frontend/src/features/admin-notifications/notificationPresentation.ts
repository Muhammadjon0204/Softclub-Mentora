import type { PreviewNotification, PreviewNotificationStatus } from '../../mocks/ui-preview/notifications.preview';

export { branchDisplayName } from '../admin-preview/branchDirectory';

export type DeliveryOutcome = 'sent' | 'failed' | 'pending';

export interface DeliveryAttemptEntry {
  id: string;
  attemptNumber: number;
  atLabel: string;
  outcome: DeliveryOutcome;
  errorSummary?: string;
}

export interface PreviewNotificationDetails extends PreviewNotification {
  recipientContact: string;
  processedAtLabel: string | null;
  sentAtLabel: string | null;
  errorSummary: string | null;
  correlationId: string;
  /** Безопасные key-value поля — раздел 22 промпта, не raw JSON dump. */
  payload: { label: string; value: string }[];
  deliveryAttempts: DeliveryAttemptEntry[];
}

const SMTP_ERRORS = [
  'Провайдер вернул временную ошибку (4xx) — будет повторная попытка',
  'Превышено время ожидания ответа провайдера',
  'Получатель временно недоступен (mailbox full)',
];
const TELEGRAM_ERRORS = ['Bot заблокирован пользователем', 'Chat ID недействителен', 'Превышен лимит запросов Telegram API'];

function stableHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash;
}

function contactFor(notification: PreviewNotification, hash: number): string {
  if (notification.channel === 'Telegram') return `@user_${1000 + (hash % 8999)}`;
  const slug = notification.recipientName
    .toLowerCase()
    .split(' ')
    .map((part) => part.replace(/[^a-zа-яё]/gi, ''))
    .join('.');
  return `${slug}@softclub-academy.test`;
}

/** Достраивает preview-уведомление безопасными деталями доставки — raw JSON нигде не хранится. */
export function enrichNotification(notification: PreviewNotification): PreviewNotificationDetails {
  const hash = stableHash(notification.id);
  const isDeadLetter = notification.status === 'DeadLetter';
  const isSent = notification.status === 'Sent';
  const errorPool = notification.channel === 'Telegram' ? TELEGRAM_ERRORS : SMTP_ERRORS;
  const errorSummary = isDeadLetter ? errorPool[hash % errorPool.length] : null;

  const deliveryAttempts: DeliveryAttemptEntry[] = [];
  const attemptCount = Math.max(notification.attempts, isSent || isDeadLetter ? 1 : 0);
  for (let attemptNumber = 1; attemptNumber <= attemptCount; attemptNumber += 1) {
    const isLastAttempt = attemptNumber === attemptCount;
    const outcome: DeliveryOutcome = isLastAttempt ? (isSent ? 'sent' : isDeadLetter ? 'failed' : 'pending') : 'failed';
    deliveryAttempts.push({
      id: `${notification.id}-attempt-${attemptNumber}`,
      attemptNumber,
      atLabel: notification.createdLabel,
      outcome,
      errorSummary: outcome === 'failed' ? errorPool[(hash + attemptNumber) % errorPool.length] : undefined,
    });
  }

  return {
    ...notification,
    recipientContact: contactFor(notification, hash),
    processedAtLabel: notification.status === 'Processing' || isSent || isDeadLetter ? notification.createdLabel : null,
    sentAtLabel: isSent ? notification.createdLabel : null,
    errorSummary,
    correlationId: `corr-${notification.id}-${(hash % 90000) + 10000}`,
    payload: [
      { label: 'Событие', value: notification.eventLabel },
      { label: 'Получатель', value: notification.recipientName },
      { label: 'Канал', value: notification.channel },
    ],
    deliveryAttempts,
  };
}

export const NOTIFICATION_RETRYABLE_STATUSES: PreviewNotificationStatus[] = ['DeadLetter'];

export function canRetryNotification(status: PreviewNotificationStatus): boolean {
  return NOTIFICATION_RETRYABLE_STATUSES.includes(status);
}

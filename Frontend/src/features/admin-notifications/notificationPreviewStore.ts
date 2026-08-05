import { useSyncExternalStore } from 'react';

import { PREVIEW_NOTIFICATIONS } from '../../mocks/ui-preview/notifications.preview';
import { enrichNotification } from './notificationPresentation';
import type { PreviewNotificationDetails } from './notificationPresentation';

/** Единственная мутация этого домена — retry (раздел 38 промпта). */
let notifications: PreviewNotificationDetails[] = PREVIEW_NOTIFICATIONS.map(enrichNotification);
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PreviewNotificationDetails[] {
  return notifications;
}

export function useNotificationsPreview(): PreviewNotificationDetails[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export class NotificationPreviewError extends Error {}

/** Attempts не сбрасываются — добавляется новая попытка (раздел 23 промпта). */
export function retryNotificationPreview(id: string): PreviewNotificationDetails {
  const existing = notifications.find((notification) => notification.id === id);
  if (existing === undefined) throw new NotificationPreviewError('Уведомление не найдено');

  let updated: PreviewNotificationDetails = existing;
  notifications = notifications.map((notification) => {
    if (notification.id !== id) return notification;
    const nextAttemptNumber = notification.attempts + 1;
    updated = {
      ...notification,
      status: 'Processing',
      attempts: nextAttemptNumber,
      nextRetryLabel: null,
      errorSummary: null,
      deliveryAttempts: [
        ...notification.deliveryAttempts,
        { id: `${notification.id}-attempt-${nextAttemptNumber}`, attemptNumber: nextAttemptNumber, atLabel: 'Сейчас', outcome: 'pending' },
      ],
    };
    return updated;
  });
  emit();
  return updated;
}

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

/*
 * `enrichNotification()` used to live here — it fabricated `recipientContact` (a fake email like
 * `имя.фамилия@softclub-academy.test`, or a fake `@user_NNNN` Telegram handle) and other delivery
 * detail fields from a hash of the notification id, for `NotificationDetailsDrawer.tsx` and its
 * children. That whole detail-drawer sub-feature has zero callers from any routed page (confirmed:
 * `pages/admin/NotificationsPage.tsx` does not render it) — deleted outright rather than left as
 * fabricated data one accidental import away from reaching a real page.
 */

export const NOTIFICATION_RETRYABLE_STATUSES: PreviewNotificationStatus[] = ['DeadLetter'];

export function canRetryNotification(status: PreviewNotificationStatus): boolean {
  return NOTIFICATION_RETRYABLE_STATUSES.includes(status);
}

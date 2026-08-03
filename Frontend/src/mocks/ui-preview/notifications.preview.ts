/** Демо-данные страницы /admin/notifications (UI-прототип, раздел 12 сессии). */

export type PreviewNotificationChannel = 'Email' | 'Telegram';
export type PreviewNotificationStatus = 'Pending' | 'Processing' | 'Sent' | 'DeadLetter';

export const NOTIFICATION_STATUS_LABEL: Record<PreviewNotificationStatus, string> = {
  Pending: 'В очереди',
  Processing: 'Обрабатывается',
  Sent: 'Отправлено',
  DeadLetter: 'Ошибка доставки',
};

export interface PreviewNotification {
  id: string;
  eventLabel: string;
  recipientName: string;
  channel: PreviewNotificationChannel;
  branchName: string;
  status: PreviewNotificationStatus;
  attempts: number;
  createdLabel: string;
  nextRetryLabel: string | null;
}

const EVENTS = [
  'Задание назначено', 'Дедлайн приближается', 'Задание одобрено', 'Требуется доработка',
  'Приглашение в организацию', 'Сброс пароля', 'Еженедельный отчёт Lead', 'Задание просрочено',
];
const RECIPIENTS = [
  'Рустам Раҳимов', 'Гулнора Саидова', 'Джамшед Юлдашев', 'Зарина Умарова', 'Хуршед Абдуллоев',
  'Сухроб Холов', 'Шахноза Мирзоева', 'Далер Сафаров', 'Умедчода Парвиз', 'Нигина Джалолова',
];
const BRANCHES = ['Главный офис', 'Филиал Худжанд', 'Филиал Бохтар'];
const STATUS_CYCLE: PreviewNotificationStatus[] = ['Sent', 'Sent', 'Sent', 'Pending', 'Processing', 'Sent', 'DeadLetter'];

function buildNotifications(count: number): PreviewNotification[] {
  const rows: PreviewNotification[] = [];
  for (let index = 0; index < count; index += 1) {
    const status = STATUS_CYCLE[index % STATUS_CYCLE.length];
    rows.push({
      id: `ntf-${index + 1}`,
      eventLabel: EVENTS[index % EVENTS.length],
      recipientName: RECIPIENTS[index % RECIPIENTS.length],
      channel: index % 3 === 0 ? 'Telegram' : 'Email',
      branchName: BRANCHES[index % BRANCHES.length],
      status,
      attempts: status === 'DeadLetter' ? 5 : status === 'Pending' ? 0 : 1,
      createdLabel: index % 2 === 0 ? 'Сегодня, ' + `0${8 + (index % 9)}:1${index % 6}` : 'Вчера, 18:0' + (index % 9),
      nextRetryLabel: status === 'DeadLetter' ? null : status === 'Pending' ? 'Через 2 мин' : null,
    });
  }
  return rows;
}

export const PREVIEW_NOTIFICATIONS: PreviewNotification[] = buildNotifications(24);

export const PREVIEW_NOTIFICATION_SUMMARY = {
  pending: PREVIEW_NOTIFICATIONS.filter((n) => n.status === 'Pending').length,
  processing: PREVIEW_NOTIFICATIONS.filter((n) => n.status === 'Processing').length,
  sent: PREVIEW_NOTIFICATIONS.filter((n) => n.status === 'Sent').length,
  deadLetter: PREVIEW_NOTIFICATIONS.filter((n) => n.status === 'DeadLetter').length,
};

/** «Успешность доставки» — donut. */
export const PREVIEW_DELIVERY_SUCCESS_PCT = Math.round(
  (PREVIEW_NOTIFICATION_SUMMARY.sent / PREVIEW_NOTIFICATIONS.length) * 100,
);

import { db } from '../db';
import { allAssignments, type MockAssignment } from './assignments';
import { BRANCH_BOKHTAR, BRANCH_KHUJAND, ORGANIZATION } from './organization';
import { DAY_MS, HOUR_MS, MOCK_NOW } from './reference';

export type NotificationChannel = 'Email' | 'Telegram';
export type NotificationStatus = 'Pending' | 'Processing' | 'Sent' | 'DeadLetter';

export interface MockNotification {
  id: string;
  organizationId: string;
  branchId: string | null;
  categoryId: string | null;
  eventType: string;
  recipientId: string | null;
  recipientLabel: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  attempts: number;
  createdAt: number;
  nextAttemptAt: number | null;
  lastError: string | null;
}

const EVENT_BY_STATUS: Partial<Record<MockAssignment['status'], string>> = {
  Approved: 'ReviewApproved',
  NeedsRework: 'ReviewNeedsRework',
  Overdue: 'AssignmentOverdue',
  Submitted: 'SubmissionUploaded',
  Assigned: 'AssignmentAssigned',
};

const STATUS_CYCLE: NotificationStatus[] = ['Sent', 'Sent', 'Sent', 'Pending', 'Sent', 'DeadLetter'];
const CHANNEL_CYCLE: NotificationChannel[] = ['Email', 'Telegram', 'Email'];

const DEAD_LETTER_ERRORS = [
  'SMTP timeout: соединение с почтовым сервером не установлено за 30 с',
  'Telegram 403: bot was blocked by the user',
  'SMTP 5.1.1: адрес получателя не существует',
];

function fromAssignments(): MockNotification[] {
  const result: MockNotification[] = [];
  const assignments = allAssignments().filter((assignment) => assignment.status in EVENT_BY_STATUS);

  assignments.forEach((assignment, index) => {
    if (index % 3 !== 0) return; // не по каждому событию — иначе список нечитаем.
    const status = STATUS_CYCLE[index % STATUS_CYCLE.length];
    const recipient = db.users.find((user) => user.id === assignment.assignedToId);

    result.push({
      id: `ntf-${assignment.id}`,
      organizationId: assignment.organizationId,
      branchId: assignment.branchId,
      categoryId: assignment.categoryId,
      eventType: EVENT_BY_STATUS[assignment.status] ?? 'AssignmentAssigned',
      recipientId: recipient?.id ?? null,
      recipientLabel: recipient?.fullName ?? 'Неизвестный получатель',
      channel: CHANNEL_CYCLE[index % CHANNEL_CYCLE.length],
      status,
      attempts: status === 'DeadLetter' ? 5 : status === 'Pending' ? 1 : 1,
      createdAt: assignment.lastActivityAt,
      nextAttemptAt: status === 'Pending' ? MOCK_NOW + HOUR_MS : null,
      lastError: status === 'DeadLetter' ? DEAD_LETTER_ERRORS[index % DEAD_LETTER_ERRORS.length] : null,
    });
  });

  return result;
}

/** Organization-level и Branch-level системные события — вне scope конкретной Category. */
function systemAlerts(): MockNotification[] {
  return [
    {
      id: 'ntf-branch-without-admin-bok',
      organizationId: ORGANIZATION.id,
      branchId: BRANCH_BOKHTAR,
      categoryId: null,
      eventType: 'BranchWithoutAdmin',
      recipientId: null,
      recipientLabel: 'Организация: администраторы',
      channel: 'Email',
      status: 'Sent',
      attempts: 1,
      createdAt: MOCK_NOW - 3 * DAY_MS,
      nextAttemptAt: null,
      lastError: null,
    },
    {
      id: 'ntf-category-without-lead-khu-design',
      organizationId: ORGANIZATION.id,
      branchId: BRANCH_KHUJAND,
      categoryId: 'cat-khu-design',
      eventType: 'CategoryWithoutLead',
      recipientId: null,
      recipientLabel: 'Администраторы филиала Худжанд',
      channel: 'Email',
      status: 'Sent',
      attempts: 1,
      createdAt: MOCK_NOW - 5 * DAY_MS,
      nextAttemptAt: null,
      lastError: null,
    },
    {
      id: 'ntf-deadletter-alert-org',
      organizationId: ORGANIZATION.id,
      branchId: null,
      categoryId: null,
      eventType: 'NotificationDeadLetter',
      recipientId: null,
      recipientLabel: 'Organization Admin',
      channel: 'Email',
      status: 'DeadLetter',
      attempts: 5,
      createdAt: MOCK_NOW - 2 * HOUR_MS,
      nextAttemptAt: null,
      lastError: 'Системный алерт: накопление DeadLetter за последний час',
    },
  ];
}

let cache: MockNotification[] | null = null;

export function allNotifications(): MockNotification[] {
  cache ??= [...systemAlerts(), ...fromAssignments()].sort((a, b) => b.createdAt - a.createdAt);
  return cache;
}

export function invalidateNotificationsCache(): void {
  cache = null;
}

/** Ручной retry: DeadLetter -> Pending, Attempts сбрасывается (ТЗ NTF-014). */
export function retryNotification(id: string): MockNotification | null {
  const list = allNotifications();
  const item = list.find((entry) => entry.id === id);
  if (item === undefined || item.status !== 'DeadLetter') return null;
  item.status = 'Pending';
  item.attempts = 0;
  item.nextAttemptAt = MOCK_NOW + 60 * 1000;
  item.lastError = null;
  return item;
}

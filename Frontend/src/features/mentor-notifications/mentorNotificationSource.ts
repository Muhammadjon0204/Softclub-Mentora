import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';

export type MentorNotificationCategory = 'assignments' | 'submissions' | 'feedback' | 'system';

export interface MentorNotificationRecord {
  id: string;
  category: MentorNotificationCategory;
  title: string;
  description: string;
  occurredAt: number;
  targetPath: string;
}

/**
 * Уведомления ментора — не отдельный backend-канал (тот, что есть в
 * `mocks/domain/notifications.ts`, — это статус доставки Email/Telegram
 * Admin-раздела, другой домен), а производная лента поверх уже существующих
 * `TaskEvent` собственных Assignment (ТЗ 2.2, раздел 18.2 — каталог событий
 * `AssignmentAssigned`/`SubmissionUploaded`/`ReviewApproved`/`ReviewNeedsRework`/
 * `AssignmentOverdue`/`AssignmentCancelled`, все адресованы Mentor). Ни
 * одного придуманного значения — каждый пункт прослеживается до реального
 * `LeadTaskEventRecord` общего Assignment-стора.
 */
export function buildMentorNotifications(assignments: LeadAssignmentRecord[]): MentorNotificationRecord[] {
  const items: MentorNotificationRecord[] = [];

  for (const a of assignments) {
    const targetPath = `/mentor/tasks?assignmentId=${a.id}`;
    for (const event of a.events) {
      switch (event.kind) {
        case 'Assigned':
          items.push({
            id: `ntf-${event.id}`,
            category: 'assignments',
            title: 'Задание назначено',
            description: `«${a.title}» · ${event.actorName}`,
            occurredAt: event.occurredAt,
            targetPath,
          });
          break;
        case 'SubmissionUploaded':
          items.push({
            id: `ntf-${event.id}`,
            category: 'submissions',
            title: 'Решение отправлено на проверку',
            description: `«${a.title}»`,
            occurredAt: event.occurredAt,
            targetPath,
          });
          break;
        case 'LateSubmissionUploaded':
          items.push({
            id: `ntf-${event.id}`,
            category: 'submissions',
            title: 'Решение отправлено с опозданием',
            description: `«${a.title}»`,
            occurredAt: event.occurredAt,
            targetPath,
          });
          break;
        case 'ReviewApproved':
          items.push({
            id: `ntf-${event.id}`,
            category: 'feedback',
            title: 'Задание принято',
            description: `«${a.title}» · ${event.actorName}`,
            occurredAt: event.occurredAt,
            targetPath,
          });
          break;
        case 'ReviewNeedsRework':
          items.push({
            id: `ntf-${event.id}`,
            category: 'feedback',
            title: 'Возвращено на доработку',
            description: `«${a.title}» · ${event.actorName}`,
            occurredAt: event.occurredAt,
            targetPath,
          });
          break;
        case 'MarkedOverdue':
          items.push({
            id: `ntf-${event.id}`,
            category: 'assignments',
            title: 'Дедлайн прошёл',
            description: `«${a.title}»`,
            occurredAt: event.occurredAt,
            targetPath,
          });
          break;
        case 'Cancelled':
          items.push({
            id: `ntf-${event.id}`,
            category: 'system',
            title: 'Задание отменено',
            description: `«${a.title}»${event.detail !== undefined ? ` · ${event.detail}` : ''}`,
            occurredAt: event.occurredAt,
            targetPath,
          });
          break;
        default:
          break;
      }
    }
  }

  return items.sort((a, b) => b.occurredAt - a.occurredAt);
}

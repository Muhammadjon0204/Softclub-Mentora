import type { PreviewAssignment } from '../../mocks/ui-preview/assignments.preview';
import type { PreviewNotificationStatus } from '../../mocks/ui-preview/notifications.preview';

export { branchDisplayName } from '../admin-preview/branchDirectory';

export function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatDaysRu(n: number): string {
  return `${n} ${pluralizeRu(n, 'день', 'дня', 'дней')}`;
}

export interface DeadlineDisplay {
  primary: string;
  secondary?: string;
  overdue: boolean;
}

/** `dueLabel` в mock-данных уже относительная строка («Через N дн.» и т.п.) — приводим к естественной фразе. */
export function formatDeadline(dueLabel: string): DeadlineDisplay {
  const overdueMatch = /^Просрочено на (\d+) дн\.$/.exec(dueLabel);
  if (overdueMatch) {
    const n = Number(overdueMatch[1]);
    return { primary: 'Просрочено', secondary: `на ${formatDaysRu(n)}`, overdue: true };
  }
  const todayPlusMatch = /^Сегодня \+ (\d+) дн\.$/.exec(dueLabel);
  const throughMatch = /^Через (\d+) дн\.$/.exec(dueLabel);
  const raw = todayPlusMatch?.[1] ?? throughMatch?.[1];
  if (raw === undefined) return { primary: dueLabel, overdue: false };
  const n = Number(raw);
  if (n <= 0) return { primary: 'Сегодня', overdue: false };
  if (n === 1) return { primary: 'Завтра', overdue: false };
  return { primary: `Через ${formatDaysRu(n)}`, overdue: false };
}

export function formatDeadlineInline(dueLabel: string): string {
  const deadline = formatDeadline(dueLabel);
  return deadline.secondary !== undefined ? `${deadline.primary} — ${deadline.secondary}` : deadline.primary;
}

export function formatActivity(label: string): string {
  const match = /^(\d+) дн\. назад$/.exec(label);
  if (!match) return label;
  const n = Number(match[1]);
  return `${formatDaysRu(n)} назад`;
}

export type TaskEventKind =
  | 'DraftCreated'
  | 'Assigned'
  | 'SubmissionUploaded'
  | 'LateSubmissionUploaded'
  | 'ReviewStarted'
  | 'ReviewApproved'
  | 'ReviewNeedsRework'
  | 'MarkedOverdue'
  | 'Cancelled';

export const TASK_EVENT_LABEL: Record<TaskEventKind, string> = {
  DraftCreated: 'Черновик создан',
  Assigned: 'Назначено',
  SubmissionUploaded: 'Отправлено на проверку',
  LateSubmissionUploaded: 'Отправлено с опозданием',
  ReviewStarted: 'Взято на проверку',
  ReviewApproved: 'Одобрено',
  ReviewNeedsRework: 'Возвращено на доработку',
  MarkedOverdue: 'Помечено как просроченное',
  Cancelled: 'Отменено',
};

export interface TaskEventEntry {
  id: string;
  kind: TaskEventKind;
  label: string;
  detail?: string;
  actorName: string;
  relativeTime: string;
  absoluteLabel: string;
}

export type FileExtension = 'pdf' | 'pptx';

export interface SubmissionFile {
  id: string;
  name: string;
  extension: FileExtension;
  sizeLabel: string;
  uploadedLabel: string;
}

export interface SubmissionEntry {
  id: string;
  versionNumber: number;
  submittedAtLabel: string;
  comment: string | null;
  files: SubmissionFile[];
  late: boolean;
}

export interface ReviewInfo {
  reviewerName: string;
  decision: 'Approved' | 'NeedsRework';
  decidedAtLabel: string;
  comment: string | null;
  submissionVersion: number;
}

export interface DeadlineChangeEntry {
  id: string;
  fromLabel: string;
  toLabel: string;
  changedByName: string;
  reason: string;
  changedAtLabel: string;
}

export interface RelatedNotificationEntry {
  id: string;
  eventLabel: string;
  channel: 'Email' | 'Telegram';
  status: PreviewNotificationStatus;
  sentLabel: string;
}

export interface PreviewAssignmentDetails extends PreviewAssignment {
  description: string;
  assignedByName: string;
  assignedAtLabel: string;
  initialDueLabel: string;
  currentDueLabel: string;
  completedAtLabel: string | null;
  allowLateSubmission: boolean;
  submissions: SubmissionEntry[];
  review: ReviewInfo | null;
  deadlineHistory: DeadlineChangeEntry[];
  events: TaskEventEntry[];
  notifications: RelatedNotificationEntry[];
}

function stableHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash;
}

const LEADS_BY_CATEGORY: Record<string, string> = {
  'C#': 'Сухроб Холов',
  Frontend: 'Шахноза Мирзоева',
  Python: 'Далер Сафаров',
  'UI/UX Design': 'Не назначен',
  'Mobile Development': 'Умедчода Парвиз',
  QA: 'Нигина Джалолова',
  DevOps: 'Комилжон Ибрагимов',
  'Data Science': 'Гулнора Саидова',
};

/** Достраивает preview-задание submissions/review/timeline/deadline history — детерминированно, по статусу. */
export function enrichAssignment(assignment: PreviewAssignment): PreviewAssignmentDetails {
  const hash = stableHash(assignment.id);
  const assignedByName = LEADS_BY_CATEGORY[assignment.categoryName] ?? 'Lead направления';
  const assignedAtLabel = '12 дн. назад';
  const currentDueLabel = assignment.dueLabel;
  const hasSubmission = assignment.status !== 'Assigned' && assignment.status !== 'Overdue';
  const isRework = assignment.status === 'NeedsRework';
  const isApproved = assignment.status === 'Approved';
  const late = assignment.status === 'Overdue';

  const files: SubmissionFile[] = hasSubmission
    ? [
        {
          id: `${assignment.id}-file-1`,
          name: `${assignment.title.slice(0, 40)}.pdf`,
          extension: 'pdf',
          sizeLabel: `${1 + (hash % 6)}.${hash % 10} МБ`,
          uploadedLabel: assignment.lastActivityLabel,
        },
        ...(hash % 3 === 0
          ? [
              {
                id: `${assignment.id}-file-2`,
                name: `Презентация — ${assignment.title.slice(0, 28)}.pptx`,
                extension: 'pptx' as const,
                sizeLabel: `${2 + (hash % 8)}.${hash % 10} МБ`,
                uploadedLabel: assignment.lastActivityLabel,
              },
            ]
          : []),
      ]
    : [];

  const submissions: SubmissionEntry[] = hasSubmission
    ? [
        {
          id: `${assignment.id}-sub-1`,
          versionNumber: 1,
          submittedAtLabel: assignment.lastActivityLabel,
          comment: hash % 2 === 0 ? 'Решение готово, приложил файлы согласно шаблону задания.' : null,
          files,
          late: false,
        },
      ]
    : [];

  const events: TaskEventEntry[] = [
    { id: `${assignment.id}-ev-1`, kind: 'DraftCreated', label: TASK_EVENT_LABEL.DraftCreated, actorName: assignedByName, relativeTime: assignedAtLabel, absoluteLabel: assignedAtLabel },
    { id: `${assignment.id}-ev-2`, kind: 'Assigned', label: TASK_EVENT_LABEL.Assigned, detail: assignment.mentorName, actorName: assignedByName, relativeTime: assignedAtLabel, absoluteLabel: assignedAtLabel },
  ];

  if (hasSubmission) {
    events.push({
      id: `${assignment.id}-ev-3`,
      kind: 'SubmissionUploaded',
      label: TASK_EVENT_LABEL.SubmissionUploaded,
      detail: 'Версия 1',
      actorName: assignment.mentorName,
      relativeTime: assignment.lastActivityLabel,
      absoluteLabel: assignment.lastActivityLabel,
    });
  }

  let review: ReviewInfo | null = null;
  const deadlineHistory: DeadlineChangeEntry[] = [];

  if (assignment.status === 'InReview') {
    events.push({ id: `${assignment.id}-ev-4`, kind: 'ReviewStarted', label: TASK_EVENT_LABEL.ReviewStarted, actorName: assignedByName, relativeTime: 'Сегодня', absoluteLabel: 'Сегодня' });
  }

  if (isRework) {
    events.push({ id: `${assignment.id}-ev-4`, kind: 'ReviewStarted', label: TASK_EVENT_LABEL.ReviewStarted, actorName: assignedByName, relativeTime: assignment.lastActivityLabel, absoluteLabel: assignment.lastActivityLabel });
    events.push({
      id: `${assignment.id}-ev-5`,
      kind: 'ReviewNeedsRework',
      label: TASK_EVENT_LABEL.ReviewNeedsRework,
      actorName: assignedByName,
      relativeTime: 'Сегодня',
      absoluteLabel: 'Сегодня',
    });
    review = {
      reviewerName: assignedByName,
      decision: 'NeedsRework',
      decidedAtLabel: 'Сегодня',
      comment: 'Нужно доработать обработку граничных случаев и добавить тесты перед повторной отправкой.',
      submissionVersion: 1,
    };
    deadlineHistory.push({
      id: `${assignment.id}-dl-1`,
      fromLabel: 'Через 2 дня',
      toLabel: currentDueLabel,
      changedByName: assignedByName,
      reason: 'Продление после возврата на доработку',
      changedAtLabel: 'Сегодня',
    });
  }

  if (isApproved) {
    events.push({ id: `${assignment.id}-ev-4`, kind: 'ReviewStarted', label: TASK_EVENT_LABEL.ReviewStarted, actorName: assignedByName, relativeTime: assignment.lastActivityLabel, absoluteLabel: assignment.lastActivityLabel });
    events.push({ id: `${assignment.id}-ev-5`, kind: 'ReviewApproved', label: TASK_EVENT_LABEL.ReviewApproved, actorName: assignedByName, relativeTime: 'Сегодня', absoluteLabel: 'Сегодня' });
    review = {
      reviewerName: assignedByName,
      decision: 'Approved',
      decidedAtLabel: 'Сегодня',
      comment: hash % 2 === 0 ? 'Хорошая работа, всё соответствует требованиям.' : null,
      submissionVersion: 1,
    };
  }

  if (late) {
    events.push({ id: `${assignment.id}-ev-3`, kind: 'MarkedOverdue', label: TASK_EVENT_LABEL.MarkedOverdue, actorName: 'Система', relativeTime: assignment.lastActivityLabel, absoluteLabel: assignment.lastActivityLabel });
  }

  const notifications: RelatedNotificationEntry[] = [
    { id: `${assignment.id}-ntf-1`, eventLabel: 'Задание назначено', channel: hash % 3 === 0 ? 'Telegram' : 'Email', status: 'Sent', sentLabel: assignedAtLabel },
    ...(hasSubmission
      ? [{ id: `${assignment.id}-ntf-2`, eventLabel: 'Решение получено', channel: 'Email' as const, status: 'Sent' as const, sentLabel: assignment.lastActivityLabel }]
      : []),
    ...(late ? [{ id: `${assignment.id}-ntf-3`, eventLabel: 'Задание просрочено', channel: 'Email' as const, status: hash % 5 === 0 ? ('DeadLetter' as const) : ('Sent' as const), sentLabel: assignment.lastActivityLabel }] : []),
  ];

  return {
    ...assignment,
    description: `Практическое задание по направлению «${assignment.categoryName}» — ${assignment.source.toLowerCase()}.`,
    assignedByName,
    assignedAtLabel,
    initialDueLabel: isRework ? 'Через 2 дня' : currentDueLabel,
    currentDueLabel,
    completedAtLabel: isApproved ? 'Сегодня' : null,
    allowLateSubmission: true,
    submissions,
    review,
    deadlineHistory,
    events: events.reverse(),
    notifications,
  };
}

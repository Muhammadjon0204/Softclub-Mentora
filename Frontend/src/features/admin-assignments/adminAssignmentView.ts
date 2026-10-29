import type { BadgeTone } from '../../shared/ui/Badge';
import { TASK_EVENT_LABEL, formatDaysRu, pluralizeRu } from './assignmentPresentation';
import { intlLocale } from '../../shared/i18n/intl';

/** Русские названия статусов `AssignmentStatus` (backend) — те же, что у руководителя. */
export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  Draft: 'Черновик',
  Suggested: 'Предложено',
  Assigned: 'Назначено',
  Submitted: 'Отправлено',
  InReview: 'На проверке',
  NeedsRework: 'На доработке',
  Overdue: 'Просрочено',
  Approved: 'Одобрено',
  Cancelled: 'Отменено',
};

export const ASSIGNMENT_STATUS_TONE: Record<string, BadgeTone> = {
  Draft: 'neutral',
  Suggested: 'info',
  Assigned: 'brand',
  Submitted: 'info',
  InReview: 'info',
  NeedsRework: 'warning',
  Overdue: 'danger',
  Approved: 'success',
  Cancelled: 'neutral',
};

export const ACTIVE_STATUSES = ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'];
export const AWAITING_REVIEW_STATUSES = ['Submitted', 'InReview'];

export type AssignmentFilter = 'all' | 'open' | 'review' | 'rework' | 'overdue' | 'approved' | 'cancelled';

export const ASSIGNMENT_FILTERS: { id: AssignmentFilter; label: string; statuses: string[] | null }[] = [
  { id: 'all', label: 'Все', statuses: null },
  { id: 'open', label: 'Активные', statuses: ACTIVE_STATUSES },
  { id: 'review', label: 'На проверке', statuses: AWAITING_REVIEW_STATUSES },
  { id: 'rework', label: 'На доработке', statuses: ['NeedsRework'] },
  { id: 'overdue', label: 'Просрочены', statuses: ['Overdue'] },
  { id: 'approved', label: 'Одобрены', statuses: ['Approved'] },
  { id: 'cancelled', label: 'Отменены', statuses: ['Cancelled'] },
];

const EXTRA_EVENT_LABEL: Record<string, string> = {
  SuggestedCreated: 'Предложено расписанием',
  SuggestionAccepted: 'Предложение принято',
  Reassigned: 'Переназначено',
};

export function taskEventTitle(eventType: string): string {
  return (TASK_EVENT_LABEL as Record<string, string>)[eventType] ?? EXTRA_EVENT_LABEL[eventType] ?? eventType;
}

const HOUR = 3_600_000;

/** Подпись под датой дедлайна: сколько осталось или на сколько просрочено. Для закрытых заданий — ничего. */
export function deadlineHint(status: string, dueAtMs: number, nowMs: number): { text: string; tone: 'muted' | 'warning' | 'danger' } | null {
  if (!ACTIVE_STATUSES.includes(status)) return null;
  const diff = dueAtMs - nowMs;
  if (diff < 0) {
    const late = Math.abs(diff);
    return { text: late < 24 * HOUR ? 'срок прошёл сегодня' : `просрочено на ${formatDaysRu(Math.floor(late / (24 * HOUR)))}`, tone: 'danger' };
  }
  if (diff < HOUR) return { text: 'меньше часа', tone: 'danger' };
  if (diff < 24 * HOUR) {
    const hours = Math.floor(diff / HOUR);
    return { text: `через ${String(hours)} ${pluralizeRu(hours, 'час', 'часа', 'часов')}`, tone: 'warning' };
  }
  const days = Math.floor(diff / (24 * HOUR));
  return { text: `через ${formatDaysRu(days)}`, tone: days <= 2 ? 'warning' : 'muted' };
}

export function formatDateTimeRu(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatShortDateTimeRu(iso: string): { date: string; time: string } {
  const value = new Date(iso);
  return {
    date: value.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', ''),
    time: value.toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

export function parseAssignmentFilter(value: string | null): AssignmentFilter {
  return ASSIGNMENT_FILTERS.some((f) => f.id === value) ? (value as AssignmentFilter) : 'all';
}

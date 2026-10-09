import type { AssignmentDto } from '../../api/lead/assignments';

/**
 * Дедлайн в календаре — задание, приведённое к тому, что нужно клетке и списку:
 * что, чьё, где, когда, в каком состоянии и куда ведёт клик.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Ментор — для Lead и Admin; у Mentor `null` (это всегда он сам). */
  person: string | null;
  /** Направление и/или филиал — для Admin. */
  context: string | null;
  dueAtMs: number;
  tone: DeadlineTone;
  href: string;
}

export type DeadlineTone = 'active' | 'review' | 'rework' | 'overdue' | 'done';

/** Черновики и предложения — ещё не дедлайны, отменённые — уже нет. */
const HIDDEN_STATUSES = new Set(['Draft', 'Suggested', 'Cancelled']);

export function isCalendarVisible(dto: AssignmentDto): boolean {
  return !HIDDEN_STATUSES.has(dto.status);
}

export function toneOf(status: string): DeadlineTone {
  switch (status) {
    case 'Submitted':
    case 'InReview':
      return 'review';
    case 'NeedsRework':
      return 'rework';
    case 'Overdue':
      return 'overdue';
    case 'Approved':
      return 'done';
    default:
      return 'active';
  }
}

export const TONE_LABEL: Record<DeadlineTone, string> = {
  active: 'В работе',
  review: 'На проверке',
  rework: 'На доработке',
  overdue: 'Просрочено',
  done: 'Принято',
};

/** Классы Tailwind на токенах проекта: точка, мягкая плашка и текст для каждого состояния. */
export const TONE_CLASSES: Record<DeadlineTone, { dot: string; chip: string; text: string }> = {
  active: { dot: 'bg-brand', chip: 'bg-brand-soft hover:bg-brand-soft-hover', text: 'text-brand-active' },
  review: { dot: 'bg-info', chip: 'bg-info-soft hover:brightness-[0.97]', text: 'text-info' },
  rework: { dot: 'bg-warning', chip: 'bg-warning-soft hover:brightness-[0.97]', text: 'text-warning' },
  overdue: { dot: 'bg-danger', chip: 'bg-danger-soft hover:brightness-[0.97]', text: 'text-danger' },
  done: { dot: 'bg-success', chip: 'bg-success-soft hover:brightness-[0.97]', text: 'text-success' },
};

export const TONE_ORDER: DeadlineTone[] = ['active', 'review', 'rework', 'overdue', 'done'];

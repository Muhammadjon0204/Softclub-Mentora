import type { Assignment } from './api';
import { isActionable } from './status';

/**
 * The home screen answers «what is due, and when»: work the mentor still has to do is grouped by how
 * soon it is due; work already handed in or finished goes below it.
 */
export type SectionKey = 'overdue' | 'today' | 'week' | 'later' | 'review' | 'done';

export const SECTION_TITLE: Record<SectionKey, string> = {
  overdue: 'Просрочено',
  today: 'Сегодня',
  week: 'На этой неделе',
  later: 'Позже',
  review: 'На проверке',
  done: 'Завершённые',
};

export interface AssignmentSection {
  key: SectionKey;
  data: Assignment[];
}

const DAY = 24 * 60 * 60 * 1000;
/** Finished work stays visible for context, but only the latest few. */
export const DONE_LIMIT = 10;

function endOfDay(now: Date): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function sectionOf(a: Assignment, now: Date): SectionKey | null {
  if (a.status === 'Draft' || a.status === 'Suggested') return null;
  if (a.status === 'Submitted' || a.status === 'InReview') return 'review';
  if (a.status === 'Approved' || a.status === 'Cancelled') return 'done';
  if (!isActionable(a.status)) return null;

  const due = new Date(a.currentDueAt).getTime();
  if (a.status === 'Overdue' || due < now.getTime()) return 'overdue';
  if (due <= endOfDay(now)) return 'today';
  if (due <= endOfDay(now) + 6 * DAY) return 'week';
  return 'later';
}

const ORDER: SectionKey[] = ['overdue', 'today', 'week', 'later', 'review', 'done'];

export function groupAssignments(items: Assignment[], now: Date = new Date()): AssignmentSection[] {
  const buckets = new Map<SectionKey, Assignment[]>();
  for (const a of items) {
    const key = sectionOf(a, now);
    if (key === null) continue;
    const list = buckets.get(key) ?? [];
    list.push(a);
    buckets.set(key, list);
  }

  const byDue = (x: Assignment, y: Assignment) => Date.parse(x.currentDueAt) - Date.parse(y.currentDueAt);
  const finishedAt = (a: Assignment) => Date.parse(a.approvedAt ?? a.cancelledAt ?? a.currentDueAt);

  return ORDER.flatMap((key) => {
    const list = buckets.get(key);
    if (!list?.length) return [];
    const data =
      key === 'done'
        ? [...list].sort((x, y) => finishedAt(y) - finishedAt(x)).slice(0, DONE_LIMIT)
        : [...list].sort(byDue);
    return [{ key, data }];
  });
}

type Lang = 'ru' | 'tg' | 'en';

const RELATIVE: Record<Lang, { lessThanHour: string; h: string; d: string; inFuture: (x: string) => string; late: (x: string) => string }> = {
  ru: { lessThanHour: 'меньше часа', h: 'ч', d: 'дн.', inFuture: (x) => `через ${x}`, late: (x) => `просрочено на ${x}` },
  tg: { lessThanHour: 'камтар аз як соат', h: 'соат', d: 'рӯз', inFuture: (x) => `баъд аз ${x}`, late: (x) => `мӯҳлат ${x} гузашт` },
  en: { lessThanHour: 'under an hour', h: 'h', d: 'd', inFuture: (x) => `in ${x}`, late: (x) => `${x} overdue` },
};

/** «через 3 ч», «просрочено на 2 дн.» — the row's second line, in the chosen language. */
export function relativeDue(dueIso: string, lang: Lang, now: Date = new Date()): { text: string; overdue: boolean } {
  const w = RELATIVE[lang];
  const diff = Date.parse(dueIso) - now.getTime();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / (60 * 60 * 1000));
  const days = Math.round(abs / DAY);

  const amount = abs < 60 * 60 * 1000 ? w.lessThanHour : hours < 24 ? `${hours} ${w.h}` : `${days} ${w.d}`;
  return { text: overdue ? w.late(amount) : w.inFuture(amount), overdue };
}

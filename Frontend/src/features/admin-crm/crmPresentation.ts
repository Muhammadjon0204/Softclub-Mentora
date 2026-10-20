/** Подписи и форматирование для экрана интеграции с CRM. */

const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const DATE_YEAR = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

/** API отдаёт календарный день `2026-10-07` — без часового пояса, поэтому собираем дату локально. */
function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function formatDay(value: string, withYear = false): string {
  // «14 мая 2027 г.» → «14 мая 2027», «5 сент.» → «5 сент».
  return (withYear ? DATE_YEAR : DATE).format(parseDay(value)).replace(/\s*г\.$/, '').replace(/\.(?=\s|$)/, '');
}

export function formatRange(from: string, to: string): string {
  return `${formatDay(from)} — ${formatDay(to, true)}`;
}

export const GROUP_STATUS_LABEL: Record<string, string> = {
  Started: 'Идёт',
  Finished: 'Закончилась',
  Preparing: 'Набор',
};

export const STUDENT_STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'warning' | 'info' | 'danger' }> = {
  Active: { label: 'Учится', tone: 'success' },
  Finished: { label: 'Закончил', tone: 'info' },
  Left: { label: 'Ушёл', tone: 'danger' },
  Transferred: { label: 'Переведён', tone: 'warning' },
  Unknown: { label: 'Неизвестно', tone: 'neutral' },
};

export const ABSENCE_LABEL: Record<string, string> = {
  Absence: 'пропуск',
  Excused: 'отпросился',
  Unmarked: 'не был',
};

/** Период: «Неделя 6» или «Недели 13–14» у детских групп. */
export function periodTitle(label: string): string {
  return label.includes('-') ? `Недели ${label.replace('-', '–')}` : `Неделя ${label}`;
}

export function totalTone(total: number): string {
  if (total > 100) return 'text-danger';
  if (total >= 80) return 'text-success';
  if (total >= 60) return 'text-warning';
  return 'text-ink';
}

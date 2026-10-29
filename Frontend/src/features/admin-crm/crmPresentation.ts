/** Подписи и форматирование для экрана интеграции с CRM. */
import { lazyDateTimeFormat } from '../../shared/i18n/intl';

const DATE = lazyDateTimeFormat({ day: 'numeric', month: 'short' });
const DATE_YEAR = lazyDateTimeFormat({ day: 'numeric', month: 'short', year: 'numeric' });

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
  Other: 'другое',
  NoReason: 'не был, без причины',
  NoMark: 'не был (в CRM нет отметки)',
};

export const REMARK_LABEL: Record<string, string> = {
  CultureViolation: 'нарушение культуры',
  Cheating: 'списывание',
  BadBehavior: 'поведение',
  Other: 'заметка',
};

/** Период: «Неделя 6» или «Недели 13–14» у детских групп. */
export function periodTitle(label: string): string {
  return label.includes('-') ? `Недели ${label.replace('-', '–')}` : `Неделя ${label}`;
}

export const ZONE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger'; text: string }> = {
  Pass: { label: 'проходит', tone: 'success', text: 'text-success' },
  Support: { label: 'нужна поддержка', tone: 'warning', text: 'text-warning' },
  Risk: { label: 'зона риска', tone: 'danger', text: 'text-danger' },
};

/** Цвет балла по зоне: 80+ зелёный, 70–79 жёлтый, ниже 70 красный. */
export function zoneText(zone: string | null | undefined): string {
  return zone ? ZONE[zone]?.text ?? 'text-ink' : 'text-ink-muted';
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${String(value)}%`;
}

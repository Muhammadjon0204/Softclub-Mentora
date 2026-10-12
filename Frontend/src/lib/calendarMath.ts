/**
 * Календарная арифметика дедлайнов. Все даты — в часовом поясе направления/филиала
 * (`UX-001`): «какой это день» для дедлайна 23:30 по Душанбе не должен зависеть от того,
 * в каком поясе открыт браузер. Сами клетки месяца — чистые календарные даты (год/месяц/день
 * без времени), их арифметика идёт в UTC, где нет переходов на летнее время.
 */

export interface ZonedParts {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZoneId: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZoneId);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    partsFormatters.set(timeZoneId, formatter);
  }
  return formatter;
}

export function zonedParts(timestampMs: number, timeZoneId: string): ZonedParts {
  const parts = partsFormatter(timeZoneId).formatToParts(timestampMs);
  const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute') };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** `YYYY-MM-DD` дня, в который момент попадает в указанном поясе. */
export function dayKeyOf(timestampMs: number, timeZoneId: string): string {
  const { year, month, day } = zonedParts(timestampMs, timeZoneId);
  return toDayKey(year, month, day);
}

/**
 * Полночь календарного дня в поясе, как UTC-момент — граница диапазона запроса.
 * Смещение пояса берётся на сам этот момент, затем уточняется один раз: этого хватает и для
 * дней перехода на летнее время, где смещение в полночь отличается от смещения в полдень.
 */
export function zonedMidnightUtc(year: number, month: number, day: number, timeZoneId: string): number {
  const asUtc = Date.UTC(year, month - 1, day);
  const offsetAt = (instant: number): number => {
    const p = zonedParts(instant, timeZoneId);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / 60_000) * 60_000;
  };
  const first = asUtc - offsetAt(asUtc);
  return asUtc - offsetAt(first);
}

export interface MonthCell {
  key: string;
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
  /** 0 = понедельник … 6 = воскресенье. */
  weekday: number;
}

/** Шесть недель с понедельника — у сетки постоянная высота, месяц не «прыгает» при листании. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const start = Date.UTC(year, month - 1, 1 - leading);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start + index * 86_400_000);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    return { key: toDayKey(y, m, d), year: y, month: m, day: d, inMonth: m === month, weekday: index % 7 };
  });
}

export interface YearMonth {
  year: number;
  month: number;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** UTC-границы всей видимой сетки месяца: с первой до последней показанной клетки включительно. */
export function gridRangeUtc(target: YearMonth, timeZoneId: string): { fromMs: number; toMs: number } {
  const cells = monthGrid(target.year, target.month);
  const first = cells[0];
  const last = cells[cells.length - 1];
  const afterLast = new Date(Date.UTC(last.year, last.month - 1, last.day + 1));
  return {
    fromMs: zonedMidnightUtc(first.year, first.month, first.day, timeZoneId),
    toMs: zonedMidnightUtc(afterLast.getUTCFullYear(), afterLast.getUTCMonth() + 1, afterLast.getUTCDate(), timeZoneId),
  };
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Разложение промежутка (по модулю) на дни/часы/минуты/секунды. */
export function countdownParts(diffMs: number): CountdownParts {
  const total = Math.floor(Math.abs(diffMs) / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const;

export const MONTH_NAMES_GENITIVE_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

export const WEEKDAY_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export const WEEKDAY_LONG_RU = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'] as const;

/** День недели календарной даты, 0 = понедельник. */
export function weekdayOf(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function formatTime(timestampMs: number, timeZoneId: string): string {
  const { hour, minute } = zonedParts(timestampMs, timeZoneId);
  return `${pad2(hour)}:${pad2(minute)}`;
}

import { MONTH_NAMES_GENITIVE_RU, parseDayKey, toDayKey, weekdayOf } from './calendarMath';

const WEEKDAY_LONG_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

/** Сегодня по часам устройства, `YYYY-MM-DD`. */
export function todayKey(): string {
  const now = new Date();
  return toDayKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDaysToKey(key: string, days: number): string {
  const { year, month, day } = parseDayKey(key);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** «пт, 16 октября 2026» — дата целиком, без двусмысленности 10/12 vs 12/10. */
export function formatDayKeyRu(key: string): string {
  const { year, month, day } = parseDayKey(key);
  return `${WEEKDAY_LONG_SHORT[weekdayOf(year, month, day)]}, ${day} ${MONTH_NAMES_GENITIVE_RU[month - 1]} ${year}`;
}


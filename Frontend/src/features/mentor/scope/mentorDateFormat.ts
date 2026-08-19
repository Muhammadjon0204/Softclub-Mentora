import { pluralizeRu } from '../../admin-assignments/assignmentPresentation';
import { DAY_MS, HOUR_MS, MINUTE_MS, MOCK_NOW } from '../../../mocks/domain/reference';

/**
 * Порт `features/lead/scope/leadDateFormat.ts` для Mentor-раздела. Дедлайны и
 * любые даты показываются в часовом поясе категории с явной меткой зоны —
 * часовой пояс браузера не используется.
 */
export function formatCategoryDateTime(timestampMs: number, timeZoneId: string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timeZoneId,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(timestampMs);

  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')} (${timeZoneId})`;
}

export function formatCategoryDate(timestampMs: number, timeZoneId: string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timeZoneId,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(timestampMs);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}

/** «Сейчас» детерминированного preview-мира — тот же якорь, что использует остальной mock-слой. */
export function mentorNow(): number {
  return MOCK_NOW;
}

/** Календарный день (YYYY-MM-DD) в часовом поясе категории — ключ для группировки занятий по дате, а не по разнице в часах. */
export function calendarDateKey(timestampMs: number, timeZoneId: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timeZoneId, year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestampMs);
}

export function isSameCategoryDay(aMs: number, bMs: number, timeZoneId: string): boolean {
  return calendarDateKey(aMs, timeZoneId) === calendarDateKey(bMs, timeZoneId);
}

/** «Сегодня» / «Завтра» / «понедельник, 12 августа» — заголовок группы дня в расписании. */
export function categoryDayLabel(timestampMs: number, timeZoneId: string): string {
  const todayKey = calendarDateKey(MOCK_NOW, timeZoneId);
  const tomorrowKey = calendarDateKey(MOCK_NOW + DAY_MS, timeZoneId);
  const key = calendarDateKey(timestampMs, timeZoneId);
  if (key === todayKey) return 'Сегодня';
  if (key === tomorrowKey) return 'Завтра';
  const label = new Intl.DateTimeFormat('ru-RU', { timeZone: timeZoneId, weekday: 'long', day: '2-digit', month: 'long' }).format(timestampMs);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface RelativeMoment {
  label: string;
  isPast: boolean;
  isOverdue: boolean;
}

/** Относительная метка «через N / N назад» — для дедлайнов, сессий и «последней активности». */
export function formatRelative(timestampMs: number, referenceMs: number = MOCK_NOW): RelativeMoment {
  const diff = timestampMs - referenceMs;
  const isPast = diff < 0;
  const abs = Math.abs(diff);

  if (abs < MINUTE_MS) {
    return { label: 'только что', isPast: false, isOverdue: false };
  }

  if (abs < HOUR_MS) {
    const minutes = Math.max(1, Math.round(abs / MINUTE_MS));
    return {
      label: isPast ? `${String(minutes)} мин. назад` : `через ${String(minutes)} мин.`,
      isPast,
      isOverdue: isPast,
    };
  }
  if (abs < DAY_MS) {
    const hours = Math.round(abs / HOUR_MS);
    return {
      label: isPast ? `${String(hours)} ч. назад` : `через ${String(hours)} ч.`,
      isPast,
      isOverdue: isPast,
    };
  }
  const days = Math.round(abs / DAY_MS);
  if (days === 0) return { label: 'сегодня', isPast: false, isOverdue: false };
  if (!isPast && days === 1) return { label: 'завтра', isPast: false, isOverdue: false };
  return {
    label: isPast ? `${formatDaysRuLocal(days)} назад` : `через ${formatDaysRuLocal(days)}`,
    isPast,
    isOverdue: isPast,
  };
}

function formatDaysRuLocal(n: number): string {
  return `${String(n)} ${pluralizeRu(n, 'день', 'дня', 'дней')}`;
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)} ч`;
}

/**
 * «Последняя активность» хранится в mock-фикстурах как смещение в часах от
 * `MOCK_NOW`, а не как абсолютная метка времени — единая точка перевода в
 * текст (см. обоснование в `leadDateFormat.ts`).
 */
export function formatOffsetHoursAgo(offsetHours: number | null): string {
  if (offsetHours === null) return 'Ещё не было активности';
  return formatRelative(MOCK_NOW - offsetHours * HOUR_MS).label;
}

const KNOWN_UTC_OFFSET_MINUTES: Record<string, number> = {
  'Asia/Dushanbe': 5 * 60,
};

/** Локальные `<input type="date">`/`<input type="time">` значения категории -> UTC миллисекунды. */
export function localInputToUtcMs(dateValue: string, timeValue: string, timeZoneId: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (dateMatch === null || timeMatch === null) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const offsetMinutes = KNOWN_UTC_OFFSET_MINUTES[timeZoneId] ?? 0;

  const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) - offsetMinutes * MINUTE_MS;
  return utcMs;
}

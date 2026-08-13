import { pluralizeRu } from '../../admin-assignments/assignmentPresentation';
import { DAY_MS, HOUR_MS, MINUTE_MS, MOCK_NOW } from '../../../mocks/domain/reference';

/**
 * ТЗ 2.2, раздел 14.6 (`UX-001`…`UX-003`): дедлайны и любые даты показываются
 * ТОЛЬКО в часовом поясе категории с явной меткой зоны — часовой пояс браузера
 * не используется. `Intl.DateTimeFormat` с `timeZone` даёт это по-настоящему
 * (не просто текстовый суффикс), а не только в отображаемой метке.
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
export function leadNow(): number {
  return MOCK_NOW;
}

export interface RelativeMoment {
  label: string;
  isPast: boolean;
  isOverdue: boolean;
}

/** Относительная метка «через N / N назад» — для дедлайнов и «последней активности». */
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
 * `MOCK_NOW` (`MentorDirectoryEntry.lastActiveOffsetHours`), а не как
 * абсолютная метка времени. Единая точка перевода в текст — если вызывающий
 * код вместо этого возьмёт `Date.now()`, результат разъедет со всем
 * остальным детерминированным preview-миром (реальная дата сессии позже
 * `MOCK_NOW`, и разница читается как «через N дней» вместо «N назад»).
 */
export function formatOffsetHoursAgo(offsetHours: number | null): string {
  if (offsetHours === null) return 'Ещё не заходил';
  return formatRelative(MOCK_NOW - offsetHours * HOUR_MS).label;
}

/**
 * Смещение UTC часовых поясов, используемых в preview mock-данных. Полноценная
 * конвертация «локальное время → UTC» на клиенте требует IANA tzdata (ТЗ
 * раздел 14.2 явно требует NodaTime на backend, включая обработку DST,
 * раздел 14.3) — здесь только для preview-формы создания задания, где
 * единственный используемый пояс `Asia/Dushanbe` не имеет перехода на летнее
 * время, поэтому фиксированное смещение безопасно для demo-данных.
 */
const KNOWN_UTC_OFFSET_MINUTES: Record<string, number> = {
  'Asia/Dushanbe': 5 * 60,
};

/** Локальные `<input type="date">`/`<input type="time">` значения категории -> UTC миллисекунды (ТЗ 14.2, ASN-027). */
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

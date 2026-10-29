import type { AuthUser } from '../../api/auth';
import { readPreference, writePreference } from '../../lib/preferenceStorage';

/** Общий ключ статуса Telegram — его читают и карточка Telegram, и настройки уведомлений. */
export const TELEGRAM_STATUS_QUERY_KEY = ['telegram-status'] as const;

export function roleLabel(user: AuthUser): string {
  if (user.role === 'Admin') return user.adminScope === 'Organization' ? 'Администратор организации' : 'Администратор филиала';
  if (user.role === 'Lead') return 'Руководитель направления';
  return 'Ментор';
}

export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Цвет подложки аватара — личный выбор, хранится только в этом браузере. */
export const AVATAR_COLORS = [
  { id: 'indigo', label: 'Индиго', className: 'bg-brand-soft text-brand', swatch: 'bg-brand' },
  { id: 'blue', label: 'Синий', className: 'bg-info-soft text-info', swatch: 'bg-info' },
  { id: 'green', label: 'Зелёный', className: 'bg-success-soft text-success', swatch: 'bg-success' },
  { id: 'amber', label: 'Янтарный', className: 'bg-warning-soft text-warning', swatch: 'bg-warning' },
  { id: 'rose', label: 'Розовый', className: 'bg-danger-soft text-danger', swatch: 'bg-danger' },
  { id: 'slate', label: 'Графит', className: 'bg-surface-muted text-ink-secondary', swatch: 'bg-ink-secondary' },
] as const;

export type AvatarColorId = (typeof AVATAR_COLORS)[number]['id'];

const avatarKey = (userId: string): string => `ravand.avatarColor.${userId}`;
export const AVATAR_COLOR_EVENT = 'ravand:avatar-color';

export function readAvatarColor(userId: string): AvatarColorId {
  const stored = readPreference(avatarKey(userId));
  return AVATAR_COLORS.some((c) => c.id === stored) ? (stored as AvatarColorId) : 'indigo';
}

export function writeAvatarColor(userId: string, color: AvatarColorId): void {
  writePreference(avatarKey(userId), color);
  window.dispatchEvent(new CustomEvent(AVATAR_COLOR_EVENT, { detail: { userId, color } }));
}

export function avatarColorClass(color: AvatarColorId): string {
  return AVATAR_COLORS.find((c) => c.id === color)?.className ?? AVATAR_COLORS[0].className;
}

const CITY_RU: Record<string, string> = {
  'Asia/Dushanbe': 'Душанбе',
  'Asia/Tashkent': 'Ташкент',
  'Asia/Almaty': 'Алматы',
  'Asia/Bishkek': 'Бишкек',
  'Europe/Moscow': 'Москва',
};

/** «Душанбе (UTC+5)». */
export function timeZoneLabel(timeZoneId: string): string {
  const city = CITY_RU[timeZoneId] ?? timeZoneId.split('/').pop()?.replace(/_/g, ' ') ?? timeZoneId;
  let offset = '';
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    offset = part !== undefined ? part.replace('GMT', 'UTC') : '';
  } catch {
    offset = '';
  }
  return offset === '' ? city : `${city} (${offset})`;
}

/** «Chrome · Windows» — грубо, но достаточно, чтобы узнать своё устройство. */
/** Телефон или планшет — для иконки устройства в блоке сессий. */
export function isHandheld(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/.test(userAgent);
}

export function describeBrowser(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Браузер';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return os === '' ? browser : `${browser} · ${os}`;
}

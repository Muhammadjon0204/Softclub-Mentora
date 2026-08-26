import type {
  AuditLogEntryDto,
  RecentAssignmentActivityDto,
  RecentAssignmentActivityStatus,
} from '../../api/admin/dashboard';
import type { DeltaTone, SemanticTone } from './dashboard.types';

/**
 * Раньше подменяла три конкретных preview-фикстуры на более "живые" названия городов для демо.
 * Реальный `Branch.Name` — то, что администратор сам ввёл при создании филиала (например,
 * "Главный офис") — не подменяется ничем; обнаружено как реальный баг при первой live-проверке
 * (2026-08-22): филиал с настоящим именем "Главный офис" отображался как "Душанбе" на Dashboard.
 */
export function formatBranchDisplayName(branchName: string): string {
  return branchName;
}

export function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** Направление roста ≠ хорошо/плохо само по себе — например, снижение очереди на проверку это позитив. */
export function deltaTone(deltaPct: number, moreIsBetter: boolean): DeltaTone {
  if (deltaPct === 0) return 'neutral';
  const isUp = deltaPct > 0;
  return isUp === moreIsBetter ? 'positive' : 'negative';
}

/**
 * Синтетические, но стабильные спарклайны вокруг текущего значения — без
 * Math.random. Каждая KPI-карточка получает свою форму тренда, а не один и
 * тот же паттерн, растянутый под разный масштаб.
 */
const SPARKLINE_SHAPES = {
  rising: [0.78, 0.83, 0.89, 0.94, 0.98, 1.02, 1.08],
  wave: [0.92, 0.86, 0.8, 0.88, 0.97, 1.03, 1.06],
  spike: [0.85, 0.95, 1.08, 1.15, 1.05, 0.96, 1.02],
  falling: [1.1, 1.04, 0.99, 0.94, 0.9, 0.86, 0.83],
} as const;

export function sparklineFor(value: number, shape: keyof typeof SPARKLINE_SHAPES): number[] {
  const base = Math.max(1, value);
  return SPARKLINE_SHAPES[shape].map((factor) => Math.round(base * factor));
}

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

export function relativeTimeLabel(iso: string, nowMs = Date.now()): string {
  const diffMs = new Date(iso).getTime() - nowMs;
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 60) return RELATIVE_FORMATTER.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return RELATIVE_FORMATTER.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_FORMATTER.format(diffDays, 'day');
}

/** «До 24 часов» — muted orange; «2–3 дня» — amber; «больше 3 дней» — зелёный/нейтральный (раздел 17 промпта). */
export function formatUpcomingDue(dueAtIso: string, nowMs = Date.now()): { label: string; tone: SemanticTone } {
  const diffMs = new Date(dueAtIso).getTime() - nowMs;
  const diffHours = diffMs / (60 * 60 * 1000);
  const diffDays = Math.max(1, Math.ceil(diffHours / 24));
  const label = `Через ${diffDays} ${pluralizeRu(diffDays, 'день', 'дня', 'дней')}`;
  const tone: SemanticTone = diffHours <= 24 ? 'warning' : diffDays <= 3 ? 'warning' : 'success';
  return { label, tone };
}

export interface FormattedActivityEntry {
  id: string;
  at: string;
  actorLabel: string;
  message: string;
  statusLabel?: string;
  tone: SemanticTone;
  /** Куда ведёт строка в ленте: задания → /admin/assignments, аудит-события → /admin/audit (раздел 21 полироли). */
  href: string;
}

const ASSIGNMENT_ACTIVITY_STATUS_LABEL: Record<RecentAssignmentActivityStatus, string> = {
  Assigned: 'Назначено',
  Submitted: 'Отправлено',
  InReview: 'На проверке',
  NeedsRework: 'На доработке',
  Overdue: 'Просрочено',
  Approved: 'Одобрено',
};

/**
 * Заданий-события не пишутся в AuditLog как дискретные записи (только текущий
 * статус на снапшоте), поэтому «Азиза Раимова отправила задание» и т.п. —
 * честная presentation-фраза, построенная из реальных `assignedToId`/
 * `assignedById`/`topicTitle`, а не выдуманный отдельный мир данных.
 */
function formatAssignmentActivity(entry: RecentAssignmentActivityDto): FormattedActivityEntry {
  const statusLabel = ASSIGNMENT_ACTIVITY_STATUS_LABEL[entry.status];
  const title = entry.title;
  const href = `/admin/assignments?assignmentId=${encodeURIComponent(entry.id)}&q=${encodeURIComponent(title)}`;

  switch (entry.status) {
    case 'Submitted':
    case 'InReview':
      return {
        id: entry.id,
        at: entry.at,
        actorLabel: entry.mentorName,
        message: `отправил задание «${title}» на проверку`,
        statusLabel,
        tone: 'info',
        href,
      };
    case 'NeedsRework':
      return {
        id: entry.id,
        at: entry.at,
        actorLabel: entry.leadName ?? 'Руководитель направления',
        message: `отправил задание «${title}» на доработку`,
        statusLabel,
        tone: 'warning',
        href,
      };
    case 'Approved':
      return {
        id: entry.id,
        at: entry.at,
        actorLabel: entry.leadName ?? 'Руководитель направления',
        message: `одобрил задание «${title}»`,
        statusLabel,
        tone: 'success',
        href,
      };
    case 'Overdue':
      return {
        id: entry.id,
        at: entry.at,
        actorLabel: 'Система',
        message: `отметила задание «${title}» как просроченное`,
        statusLabel,
        tone: 'danger',
        href,
      };
    case 'Assigned':
    default:
      return {
        id: entry.id,
        at: entry.at,
        actorLabel: entry.leadName ?? 'Система',
        message: `назначил(а) задание «${title}» ментору ${entry.mentorName}`,
        statusLabel,
        tone: 'neutral',
        href,
      };
  }
}

/**
 * Технические session/token-события (`refresh_rotated`, `refresh_session_created`,
 * `security_token_used`, `refresh_family_revoked`) не несут бизнес-смысла для
 * executive-дашборда — маппер возвращает `null`, и такие записи просто не
 * попадают в ленту (раздел 16 промпта). AuditLog domain-модель не меняется —
 * это чисто presentation-фильтр на уровне Dashboard.
 */
const AUDIT_ACTION_MAP: Partial<Record<string, { message: string; tone: SemanticTone } | null>> = {
  refresh_rotated: null,
  refresh_session_created: null,
  security_token_used: null,
  refresh_family_revoked: null,
  user_sessions_revoked: { message: 'принудительно завершил(а) сессии пользователя', tone: 'warning' },
  token_reuse_detected: { message: 'обнаружено подозрительное использование сессии', tone: 'danger' },
  login_success: { message: 'вошёл(а) в систему', tone: 'neutral' },
  login_denied: { message: 'попытка входа отклонена', tone: 'warning' },
  account_locked: { message: 'аккаунт заблокирован после нескольких неудачных попыток входа', tone: 'warning' },
  logout: { message: 'вышел(а) из системы', tone: 'neutral' },
  password_changed: { message: 'сменил(а) пароль', tone: 'neutral' },
  'bootstrap.provision': { message: 'выполнил(а) первичную настройку организации', tone: 'neutral' },
  'branch.create': { message: 'создал(а) новый филиал', tone: 'success' },
  'branch.deactivate': { message: 'деактивировал(а) филиал', tone: 'warning' },
  'branch.without_admin_detected': { message: 'филиал остался без администратора', tone: 'warning' },
  'user.create': { message: 'добавил(а) пользователя', tone: 'success' },
  'user.change_category': { message: 'изменил(а) категорию пользователя', tone: 'neutral' },
  'category.create': { message: 'создал(а) категорию', tone: 'success' },
  'category.deactivate': { message: 'деактивировал(а) категорию', tone: 'warning' },
  'scheduler.no_active_mentor': { message: 'планировщик не нашёл активных менторов для категории', tone: 'warning' },
  'assignment.force_cancel': { message: 'принудительно отменил(а) задание', tone: 'warning' },
  'notification.retry': { message: 'повторно отправил(а) уведомление', tone: 'neutral' },
  'notification.dispatch': { message: 'система отправила напоминание о дедлайне', tone: 'neutral' },
  'security.scope_override_rejected': { message: 'попытка подмены области доступа отклонена', tone: 'danger' },
  'organization.update': { message: 'обновил(а) профиль организации', tone: 'neutral' },
  'audit.read': { message: 'просмотрел(а) журнал аудита', tone: 'neutral' },
};

function formatAuditActivity(entry: AuditLogEntryDto): FormattedActivityEntry | null {
  const mapped = AUDIT_ACTION_MAP[entry.action];
  if (mapped === null) return null;
  const fallback = mapped ?? { message: entry.action, tone: 'neutral' as const };

  return {
    id: entry.id,
    at: entry.at,
    actorLabel: entry.actorLabel,
    message: fallback.message,
    statusLabel: entry.result === 'Failure' ? 'Ошибка' : undefined,
    tone: entry.result === 'Failure' ? 'danger' : fallback.tone,
    href: `/admin/audit?eventId=${encodeURIComponent(entry.id)}&q=${encodeURIComponent(entry.actorLabel)}`,
  };
}

export type RawBusinessActivity =
  | { source: 'audit'; entry: AuditLogEntryDto }
  | { source: 'assignment'; entry: RecentAssignmentActivityDto };

/** Единая точка входа: превращает сырые audit/assignment-факты в одну ленту, отсортированную по времени. */
export function formatDashboardActivityEvent(raw: RawBusinessActivity): FormattedActivityEntry | null {
  return raw.source === 'audit' ? formatAuditActivity(raw.entry) : formatAssignmentActivity(raw.entry);
}

export function buildRecentActivityFeed(
  auditEntries: AuditLogEntryDto[],
  assignmentEntries: RecentAssignmentActivityDto[],
  limit: number,
): FormattedActivityEntry[] {
  const raw: RawBusinessActivity[] = [
    ...auditEntries.map((entry): RawBusinessActivity => ({ source: 'audit', entry })),
    ...assignmentEntries.map((entry): RawBusinessActivity => ({ source: 'assignment', entry })),
  ];

  return raw
    .map(formatDashboardActivityEvent)
    .filter((entry): entry is FormattedActivityEntry => entry !== null)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

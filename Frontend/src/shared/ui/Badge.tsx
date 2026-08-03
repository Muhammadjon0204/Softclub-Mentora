import type { AdminScope, UserRole } from '../../api/auth';
import type { ServiceStatus } from '../../mocks/domain/health';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-secondary border-line',
  brand: 'bg-brand-soft text-brand border-transparent',
  success: 'bg-success-soft text-success border-success-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  danger: 'bg-danger-soft text-danger border-danger-border',
  info: 'bg-info-soft text-info border-info-border',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

/**
 * Базовый тональный badge. Статус никогда не кодируется только цветом
 * (раздел 30 промпта) — компоненты выше по стеку добавляют текст и/или иконку.
 */
export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const ROLE_LABEL: Record<UserRole, string> = {
  Admin: 'Администратор',
  Lead: 'Руководитель направления',
  Mentor: 'Ментор',
};

const ROLE_TONE: Record<UserRole, BadgeTone> = {
  Admin: 'brand',
  Lead: 'info',
  Mentor: 'neutral',
};

export function RoleBadge({ role }: { role: UserRole }): JSX.Element {
  return <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>;
}

const ADMIN_SCOPE_LABEL: Record<AdminScope, string> = {
  Organization: 'Организация',
  Branch: 'Филиал',
};

export function AdminScopeBadge({ scope }: { scope: AdminScope }): JSX.Element {
  return <Badge tone={scope === 'Organization' ? 'brand' : 'info'}>{ADMIN_SCOPE_LABEL[scope]}</Badge>;
}

export function ActiveStatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  return (
    <Badge tone={isActive ? 'success' : 'neutral'}>
      <StatusDot tone={isActive ? 'success' : 'neutral'} />
      {isActive ? 'Активен' : 'Неактивен'}
    </Badge>
  );
}

const HEALTH_LABEL: Record<ServiceStatus, string> = {
  Operational: 'Работает',
  Degraded: 'Деградация',
  Unavailable: 'Недоступен',
};

const HEALTH_TONE: Record<ServiceStatus, BadgeTone> = {
  Operational: 'success',
  Degraded: 'warning',
  Unavailable: 'danger',
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }): JSX.Element {
  return (
    <Badge tone={HEALTH_TONE[status]}>
      <StatusDot tone={HEALTH_TONE[status]} />
      {HEALTH_LABEL[status]}
    </Badge>
  );
}

const DOT_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-ink-disabled',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Цветовая точка — всегда дополняет текст, никогда не единственный сигнал. */
export function StatusDot({ tone }: { tone: BadgeTone }): JSX.Element {
  return <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[tone]}`} />;
}

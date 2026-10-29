import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Database, HardDrive, Info, RefreshCw, Server, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import type { ServiceHealthDto, SystemEventDto } from '../../api/admin/dashboard';
import { isNotConfigured, relativeTimeLabel } from '../../features/admin-dashboard/dashboardFormatters';
import { useDashboardQuery } from '../../features/admin-dashboard/useDashboardQuery';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { auditActionLabel } from '../../features/admin-preview/auditPresentation';
import { Badge, ServiceStatusBadge, StatusDot } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { intlLocale } from '../../shared/i18n/intl';

type IconType = ComponentType<{ className?: string }>;

const SERVICE_META: Record<string, { icon: IconType; about: string }> = {
  postgres: { icon: Database, about: 'Задания, пользователи, решения и история' },
  storage: { icon: HardDrive, about: 'Файлы решений менторов' },
  ai: { icon: Sparkles, about: 'Краткие резюме в отчётах — необязательный сервис' },
};

const STATUS_ICON: Record<ServiceHealthDto['status'], { icon: IconType; ring: string }> = {
  Operational: { icon: CheckCircle2, ring: 'bg-success-soft text-success' },
  Degraded: { icon: AlertTriangle, ring: 'bg-warning-soft text-warning' },
  Unavailable: { icon: XCircle, ring: 'bg-danger-soft text-danger' },
};

const EVENT_LEVEL: Record<SystemEventDto['level'], { icon: IconType; ring: string; label: string; tone: BadgeTone }> = {
  info: { icon: Info, ring: 'bg-info-soft text-info', label: 'Инфо', tone: 'info' },
  warning: { icon: AlertTriangle, ring: 'bg-warning-soft text-warning', label: 'Внимание', tone: 'warning' },
  error: { icon: ShieldAlert, ring: 'bg-danger-soft text-danger', label: 'Ошибка', tone: 'danger' },
};

/** Что означает событие — коротко, для человека. */
const EVENT_EXPLANATION: Record<string, string> = {
  'auth.refresh_reuse_detected': 'Старый токен сессии использован повторно — например, вкладка открыта на двух устройствах. Сессия завершена, пользователь входит заново.',
  'security.scope_override_rejected': 'Попытка открыть данные чужого филиала отклонена.',
  'security.cross_scope_rejected': 'Запрос к данным за пределами доступа отклонён.',
  'scheduler.no_active_mentor': 'Расписание не нашло активного ментора для направления.',
  'storage.orphan_cleanup': 'Удалены файлы, которые больше ни к чему не привязаны.',
  'retention.cleanup': 'Плановая очистка старых данных.',
};

interface GroupedEvent {
  event: SystemEventDto;
  count: number;
  firstAt: string;
}

/** Одинаковые события подряд — одной строкой со счётчиком «×N». */
function groupConsecutive(events: SystemEventDto[]): GroupedEvent[] {
  const groups: GroupedEvent[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.event.message === event.message && last.event.level === event.level) {
      last.count += 1;
      last.firstAt = event.at;
    } else {
      groups.push({ event, count: 1, firstAt: event.at });
    }
  }
  return groups;
}

/** «Healthy» из ASP.NET health check — это не текст для человека. */
function serviceMessage(service: ServiceHealthDto): string {
  if (service.message === 'Healthy' || service.message.trim() === '') return 'В норме — работает без ошибок';
  if (service.message === 'Degraded') return 'Работает с ограничениями';
  if (service.message === 'Unhealthy') return 'Сервис не отвечает';
  return service.message;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function dateTimeOf(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function HealthPage(): JSX.Element {
  const query = useDashboardQuery();
  const health = query.data?.systemHealth;
  const services = health?.services ?? [];
  const problems = services.filter((service) => service.status !== 'Operational' && !isNotConfigured(service));
  const notConfigured = services.filter(isNotConfigured);
  const worst: ServiceHealthDto['status'] = problems.some((s) => s.status === 'Unavailable') ? 'Unavailable' : problems.length > 0 ? 'Degraded' : 'Operational';
  const lastChecked = services[0]?.lastCheckedAt;

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Состояние системы"
        subtitle="Работают ли база данных, хранилище файлов и AI"
        action={
          <Button variant="secondary" leadingIcon={<RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />} onClick={() => { void query.refetch(); }} disabled={query.isFetching}>
            Проверить снова
          </Button>
        }
      />

      {query.isPending ? (
        <Skeleton className="h-[92px] w-full rounded-card" />
      ) : query.error !== null ? (
        <Card><ErrorState error={query.error} title="Не удалось получить состояние системы" onRetry={() => { void query.refetch(); }} /></Card>
      ) : (
        <SummaryBanner status={worst} problems={problems} notConfigured={notConfigured} lastChecked={lastChecked} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {query.isPending
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[168px] w-full rounded-card" />)
          : services.map((service) => <ServiceCard key={service.id} service={service} />)}
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-divider px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Последние системные события</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Безопасность и фоновые процессы из журнала аудита</p>
          </div>
          <Link to="/admin/audit" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand no-underline hover:text-brand-hover">
            Журнал аудита <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        {query.isPending ? (
          <div className="space-y-3 p-5 sm:px-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (health?.recentEvents.length ?? 0) === 0 ? (
          <EmptyState icon={<Activity className="h-5 w-5" aria-hidden="true" />} title="Системных событий нет" description="Здесь появятся предупреждения безопасности и сбои фоновых задач." />
        ) : (
          <ul className="divide-y divide-divider">
            {groupConsecutive(health?.recentEvents ?? []).map(({ event, count, firstAt }) => {
              const level = EVENT_LEVEL[event.level] ?? EVENT_LEVEL.info;
              const LevelIcon = level.icon;
              const label = auditActionLabel(event.message);
              const explanation = EVENT_EXPLANATION[event.message];
              return (
                <li key={event.id} className="flex items-start gap-3.5 px-5 py-3.5 sm:px-6">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${level.ring}`}>
                    <LevelIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-medium leading-5 text-ink">{label}</p>
                      {count > 1 ? <span className="rounded-full bg-surface-muted px-1.5 text-[11.5px] font-semibold tabular-nums text-ink-secondary">×{count}</span> : null}
                      <Badge tone={level.tone}><StatusDot tone={level.tone} />{level.label}</Badge>
                    </div>
                    {explanation !== undefined ? <p className="mt-0.5 text-[12.5px] leading-[18px] text-ink-secondary">{explanation}</p> : null}
                    {label !== event.message ? <p className="mt-0.5 truncate font-mono text-[11px] text-ink-disabled">{event.message}</p> : null}
                    {count > 1 ? <p className="text-[11.5px] text-ink-muted">первое — {dateTimeOf(firstAt)}</p> : null}
                    <p className="mt-0.5 text-[11.5px] text-ink-muted sm:hidden">
                      {relativeTimeLabel(event.at)} · {dateTimeOf(event.at)}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-[12.5px] text-ink-secondary">{relativeTimeLabel(event.at)}</p>
                    <p className="text-[11.5px] tabular-nums text-ink-muted">{dateTimeOf(event.at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryBanner({
  status,
  problems,
  notConfigured,
  lastChecked,
}: {
  status: ServiceHealthDto['status'];
  problems: ServiceHealthDto[];
  notConfigured: ServiceHealthDto[];
  lastChecked: string | undefined;
}): JSX.Element {
  const meta = STATUS_ICON[status];
  const Icon = meta.icon;
  const title =
    status === 'Operational' ? 'Все системы работают штатно' : status === 'Unavailable' ? 'Есть недоступные сервисы' : 'Часть сервисов работает с ограничениями';
  const bar = status === 'Operational' ? 'bg-success' : status === 'Unavailable' ? 'bg-danger' : 'bg-warning';
  const optionalNote = notConfigured.length > 0 ? ` Не подключено (необязательно): ${notConfigured.map((s) => s.name).join(', ')}.` : '';

  return (
    <Card padded={false} className="relative overflow-hidden">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <div className="flex flex-wrap items-center gap-4 py-5 pl-6 pr-5 sm:pr-6">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${meta.ring}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {problems.length === 0 ? `Пользователи могут работать без ограничений.${optionalNote}` : `Требует внимания: ${problems.map((p) => p.name).join(', ')}.${optionalNote}`}
          </p>
        </div>
        {lastChecked !== undefined ? (
          <p className="text-[12.5px] text-ink-muted">
            Проверено в <span className="font-medium tabular-nums text-ink-secondary">{timeOf(lastChecked)}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function ServiceCard({ service }: { service: ServiceHealthDto }): JSX.Element {
  const meta = SERVICE_META[service.id] ?? { icon: Server, about: 'Внутренний сервис' };
  const Icon = meta.icon;
  const notConfigured = isNotConfigured(service);
  const healthy = service.status === 'Operational' || notConfigured;

  return (
    <Card padded={false} className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {notConfigured ? (
          <Badge tone="neutral"><StatusDot tone="neutral" />Не настроен</Badge>
        ) : (
          <ServiceStatusBadge status={service.status} />
        )}
      </div>
      <h2 className="mt-3.5 text-[15px] font-semibold text-ink">{service.name}</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">{meta.about}</p>
      <p className={`mb-3.5 mt-3 rounded-control px-3 py-2 text-[12.5px] leading-[18px] ${healthy ? 'bg-surface-muted text-ink-secondary' : 'bg-warning-soft text-warning'}`}>
        {serviceMessage(service)}
      </p>
      <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-divider pt-3.5 text-[12px]">
        <div>
          <dt className="text-ink-muted">Отклик</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">{service.latencyMs} мс</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Проверено</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">{timeOf(service.lastCheckedAt)}</dd>
        </div>
      </dl>
    </Card>
  );
}

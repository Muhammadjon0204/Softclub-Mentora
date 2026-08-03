import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import {
  PREVIEW_AVAILABILITY_24H,
  PREVIEW_SERVICES,
  PREVIEW_SYSTEM_EVENTS,
  SERVICE_STATUS_LABEL,
  type PreviewServiceStatus,
} from '../../mocks/ui-preview/health.preview';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Card, SectionCard } from '../../shared/ui/Card';

const STATUS_TONE: Record<PreviewServiceStatus, BadgeTone> = {
  Operational: 'success',
  Degraded: 'warning',
  Unavailable: 'danger',
};

const LEVEL_ICON: Record<'info' | 'warning' | 'error', JSX.Element> = {
  info: <Info className="h-3.5 w-3.5 text-info" aria-hidden="true" />,
  warning: <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden="true" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />,
};

/** UI-прототип /admin/health — без тяжёлых DevOps-графиков (раздел 13 сессии превью). */
export function HealthPage(): JSX.Element {
  const hasDegraded = PREVIEW_SERVICES.some((s) => s.status !== 'Operational');
  const availabilityData = PREVIEW_AVAILABILITY_24H.map((value, index) => ({ hour: index, value }));

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Состояние системы" subtitle="Доступность основных сервисов Mentora" />

      <Card className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${hasDegraded ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            {hasDegraded ? 'Есть сервисы с ограниченной доступностью' : 'Все системы работают'}
          </p>
          <p className="text-[12.5px] text-ink-muted">Обновлено только что</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PREVIEW_SERVICES.map((service) => (
          <Card key={service.id} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{service.name}</p>
              <Badge tone={STATUS_TONE[service.status]}>{SERVICE_STATUS_LABEL[service.status]}</Badge>
            </div>
            <p className="text-[12.5px] leading-[18px] text-ink-muted">{service.description}</p>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-control-sm bg-surface-muted px-2 py-1.5">
                <p className="text-[14px] font-semibold tabular-nums text-ink">{service.latencyMs} мс</p>
                <p className="text-[10.5px] text-ink-muted">Задержка</p>
              </div>
              <div className="rounded-control-sm bg-surface-muted px-2 py-1.5">
                <p className="text-[14px] font-semibold tabular-nums text-ink">{service.uptimePct}%</p>
                <p className="text-[10.5px] text-ink-muted">Uptime</p>
              </div>
              <div className="rounded-control-sm bg-surface-muted px-2 py-1.5">
                <p className="text-[11px] font-medium text-ink">{service.lastCheckedLabel}</p>
                <p className="text-[10.5px] text-ink-muted">Проверка</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Доступность за 24 часа" description="Доля успешных проверок по часам" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={availabilityData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="availability-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="var(--success)" strokeWidth={2} fill="url(#availability-fill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Последние системные события" padded={false}>
          <ul className="divide-y divide-divider">
            {PREVIEW_SYSTEM_EVENTS.map((event) => (
              <li key={event.id} className="flex items-start gap-2.5 px-5 py-3.5 sm:px-6">
                <span className="mt-0.5 shrink-0">{LEVEL_ICON[event.level]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-[19px] text-ink">{event.message}</p>
                  <p className="text-[11.5px] text-ink-muted">{event.timeLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';

import type { ServiceHealthDto } from '../../api/admin/dashboard';
import { Tooltip } from '../../shared/ui/Tooltip';
import { DashboardCardFooterLink } from './DashboardCardFooterLink';
import { relativeTimeLabel } from './dashboardFormatters';
import { InsightCard } from './InsightCard';

interface CompactSystemHealthCardProps {
  services: ServiceHealthDto[];
}

const STATUS_META: Record<ServiceHealthDto['status'], { dot: string; text: string; label: string }> = {
  Operational: { dot: 'bg-success', text: 'text-success', label: 'Работает' },
  Degraded: { dot: 'bg-warning', text: 'text-warning', label: 'Деградация' },
  Unavailable: { dot: 'bg-danger', text: 'text-danger', label: 'Недоступен' },
};

/**
 * Заменяет большой «Состояние системы» — только сервисы + dot-статус, без
 * списка последних системных событий (для них есть /admin/health). Теперь
 * через `InsightCard`, поэтому высота и footer совпадают с остальными тремя
 * карточками ряда (раздел 19 полироли).
 */
export function CompactSystemHealthCard({ services }: CompactSystemHealthCardProps): JSX.Element {
  const allOperational = services.every((s) => s.status === 'Operational');

  return (
    <InsightCard
      title="Здоровье системы"
      subtitle={allOperational ? 'Все системы работают стабильно' : 'Есть сервис с ограниченной доступностью'}
      footer={<DashboardCardFooterLink to="/admin/health">Открыть состояние системы</DashboardCardFooterLink>}
    >
      <ul className="flex h-full flex-col justify-start">
        {services.map((service, index) => {
          const meta = STATUS_META[service.status];
          const tooltip = `Проверено: ${relativeTimeLabel(service.lastCheckedAt)} · Задержка: ${service.latencyMs} мс`;
          return (
            <li key={service.id} className={index === services.length - 1 ? '' : 'border-b border-divider'}>
              <Link
                to={`/admin/health?service=${encodeURIComponent(service.id)}`}
                className="-mx-2 flex min-h-[44px] items-center justify-between gap-3 rounded-[8px] px-2 py-[7px] no-underline transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{service.name}</p>
                  <Tooltip content={tooltip}>
                    <span className="text-[11.5px] tabular-nums text-ink-muted">{service.latencyMs} мс</span>
                  </Tooltip>
                </div>
                <span className="flex shrink-0 items-center gap-1.5" role="status" aria-label={`Статус: ${meta.label}`}>
                  <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${meta.dot}`} />
                  <span className={`text-[12.5px] font-medium ${meta.text}`}>{meta.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </InsightCard>
  );
}

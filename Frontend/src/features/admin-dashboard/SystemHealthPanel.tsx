import { AlertCircle, Info, TriangleAlert } from 'lucide-react';

import type { ServiceHealthDto, SystemEventDto } from '../../api/admin/dashboard';
import { ServiceStatusBadge } from '../../shared/ui/Badge';

interface SystemHealthPanelProps {
  services: ServiceHealthDto[];
  recentEvents: SystemEventDto[];
}

const LEVEL_ICON: Record<SystemEventDto['level'], JSX.Element> = {
  info: <Info className="h-3.5 w-3.5 text-info" aria-hidden="true" />,
  warning: <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden="true" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />,
};

/** Понятная Admin'у сводка — не DevOps-мониторинг (раздел 20 промпта). */
export function SystemHealthPanel({ services, recentEvents }: SystemHealthPanelProps): JSX.Element {
  return (
    <div className="space-y-4">
      <ul className="space-y-1">
        {services.map((service) => (
          <li key={service.id} className="flex items-center justify-between gap-3 rounded-control-sm px-2.5 py-2 hover:bg-surface-hover">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{service.name}</p>
              <p className="truncate text-[12px] text-ink-muted">{service.message}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <ServiceStatusBadge status={service.status} />
              <span className="text-[11px] tabular-nums text-ink-disabled">{service.latencyMs} мс</span>
            </div>
          </li>
        ))}
      </ul>

      {recentEvents.length > 0 ? (
        <div className="border-t border-divider pt-3">
          <p className="mb-2 px-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Последние события
          </p>
          <ul className="space-y-2 px-2.5">
            {recentEvents.map((event) => (
              <li key={event.id} className="flex items-start gap-2 text-[12px] text-ink-secondary">
                <span className="mt-0.5 shrink-0">{LEVEL_ICON[event.level]}</span>
                <span>{event.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

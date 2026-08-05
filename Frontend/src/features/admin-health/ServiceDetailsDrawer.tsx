import { History } from 'lucide-react';
import { useState } from 'react';

import { SERVICE_STATUS_LABEL, type PreviewServiceStatus } from '../../mocks/ui-preview/health.preview';
import { Drawer } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ErrorState } from '../../shared/ui/ErrorState';
import { IncidentHistoryModal } from './IncidentHistoryModal';
import { ServiceActionMenu } from './ServiceActionMenu';
import type { PreviewServiceDetails } from './healthPresentation';

const STATUS_TONE: Record<PreviewServiceStatus, BadgeTone> = {
  Operational: 'success',
  Degraded: 'warning',
  Unavailable: 'danger',
};

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export interface ServiceDetailsDrawerProps {
  serviceKey: string | null;
  service: PreviewServiceDetails | undefined;
  onClose: () => void;
}

/** Без connection string / паролей / токенов (раздел 25 промпта) — только безопасные операционные метрики. */
export function ServiceDetailsDrawer({ serviceKey, service, onClose }: ServiceDetailsDrawerProps): JSX.Element {
  const [incidentsOpen, setIncidentsOpen] = useState(false);
  const open = serviceKey !== null;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={service?.name ?? 'Сервис'}
        description={service?.description}
        size="md"
        headerActions={
          service !== undefined ? (
            <div className="flex items-center gap-1.5">
              <Badge tone={STATUS_TONE[service.status]}>{SERVICE_STATUS_LABEL[service.status]}</Badge>
              <ServiceActionMenu service={service} context="drawer" onOpenIncidents={() => { setIncidentsOpen(true); }} />
            </div>
          ) : undefined
        }
      >
        {serviceKey === null ? null : service === undefined ? (
          <ErrorState title="Сервис не найден" error={null} />
        ) : (
          <div className="space-y-5">
            <p className="rounded-control border border-line bg-surface-muted px-3.5 py-3 text-[13px] leading-[19px] text-ink-secondary">{service.currentMessage}</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-control border border-line bg-surface p-3.5 text-center">
                <p className="text-[17px] font-bold tabular-nums text-ink">{service.latencyMs} мс</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">Задержка</p>
              </div>
              <div className="rounded-control border border-line bg-surface p-3.5 text-center">
                <p className="text-[17px] font-bold tabular-nums text-ink">{service.uptimePct}%</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">Uptime</p>
              </div>
              <div className="rounded-control border border-line bg-surface p-3.5 text-center">
                <p className="text-[13px] font-semibold text-ink">{service.lastCheckedLabel}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">Проверка</p>
              </div>
            </div>

            <dl className="divide-y divide-divider">
              <DetailRow label="Последняя успешная проверка" value={service.lastSuccessLabel} />
              <DetailRow label="Зависимости" value={service.dependencies.length > 0 ? service.dependencies.join(', ') : 'Нет'} />
            </dl>

            <Button variant="secondary" size="sm" leadingIcon={<History className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { setIncidentsOpen(true); }}>
              История инцидентов {service.incidents.length > 0 ? `(${service.incidents.length})` : ''}
            </Button>
          </div>
        )}
      </Drawer>

      <IncidentHistoryModal serviceName={service?.name ?? ''} incidents={service?.incidents ?? []} open={incidentsOpen} onOpenChange={setIncidentsOpen} />
    </>
  );
}

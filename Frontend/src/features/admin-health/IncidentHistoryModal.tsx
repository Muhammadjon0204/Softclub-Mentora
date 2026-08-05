import { AlertOctagon, ShieldCheck } from 'lucide-react';

import { Modal } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { IncidentEntry } from './healthPresentation';

const SEVERITY_TONE: Record<IncidentEntry['severity'], BadgeTone> = { minor: 'warning', major: 'danger' };
const SEVERITY_LABEL: Record<IncidentEntry['severity'], string> = { minor: 'Незначительный', major: 'Критический' };
const STATUS_LABEL: Record<IncidentEntry['status'], string> = { resolved: 'Восстановлен', ongoing: 'Продолжается' };

export interface IncidentHistoryModalProps {
  serviceName: string;
  incidents: IncidentEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read-only история — не полноценная incident management system (раздел 26 промпта). */
export function IncidentHistoryModal({ serviceName, incidents, open, onOpenChange }: IncidentHistoryModalProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`История инцидентов — ${serviceName}`} size="md">
      {incidents.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} title="Инцидентов не было" description="За выбранный период инцидентов не было." />
      ) : (
        <ol className="space-y-4">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-control border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <AlertOctagon className="h-4 w-4 text-danger" aria-hidden="true" />
                  {incident.startLabel}
                </span>
                <Badge tone={SEVERITY_TONE[incident.severity]}>{SEVERITY_LABEL[incident.severity]}</Badge>
              </div>
              <p className="mt-2 text-[12.5px] leading-[18px] text-ink-secondary">{incident.summary}</p>
              <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-ink-muted">
                <span>Длительность: {incident.durationLabel}</span>
                <span aria-hidden="true">·</span>
                <span className={incident.status === 'ongoing' ? 'font-medium text-warning' : 'font-medium text-success'}>{STATUS_LABEL[incident.status]}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

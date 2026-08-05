import type { PreviewService } from '../../mocks/ui-preview/health.preview';

export type IncidentSeverity = 'minor' | 'major';
export type IncidentStatus = 'resolved' | 'ongoing';

export interface IncidentEntry {
  id: string;
  startLabel: string;
  endLabel: string | null;
  durationLabel: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  summary: string;
}

export interface PreviewServiceDetails extends PreviewService {
  dependencies: string[];
  lastSuccessLabel: string;
  currentMessage: string;
  incidents: IncidentEntry[];
}

const DEPENDENCIES: Record<string, string[]> = {
  api: ['PostgreSQL', 'MinIO'],
  db: [],
  minio: [],
  email: [],
  telegram: [],
  scheduler: ['PostgreSQL'],
};

/** Только для сервисов не-`Operational` — детерминированный единичный ongoing-инцидент (раздел 24/26 промпта). */
export function enrichService(service: PreviewService): PreviewServiceDetails {
  const incidents: IncidentEntry[] =
    service.status === 'Degraded'
      ? [
          {
            id: `${service.id}-incident-1`,
            startLabel: 'Сегодня, 04:12',
            endLabel: null,
            durationLabel: 'Продолжается',
            severity: 'minor',
            status: 'ongoing',
            summary: service.description,
          },
        ]
      : service.status === 'Unavailable'
        ? [
            {
              id: `${service.id}-incident-1`,
              startLabel: 'Сегодня, 03:40',
              endLabel: null,
              durationLabel: 'Продолжается',
              severity: 'major',
              status: 'ongoing',
              summary: service.description,
            },
          ]
        : [];

  return {
    ...service,
    dependencies: DEPENDENCIES[service.id] ?? [],
    lastSuccessLabel: service.status === 'Operational' ? service.lastCheckedLabel : 'Сегодня, 02:55',
    currentMessage: service.status === 'Operational' ? 'Сервис работает в штатном режиме.' : service.description,
    incidents,
  };
}

import { CheckCircle2, Clock3, FileUp, ListChecks, RotateCcw, TriangleAlert, UserPlus, XCircle } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import { Tooltip } from '../../shared/overlays';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { TaskEventEntry, TaskEventKind } from './assignmentPresentation';

const KIND_META: Record<TaskEventKind, { icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }> = {
  DraftCreated: { icon: UserPlus, tone: 'bg-surface-muted text-ink-secondary' },
  Assigned: { icon: UserPlus, tone: 'bg-brand-soft text-brand' },
  SubmissionUploaded: { icon: FileUp, tone: 'bg-info-soft text-info' },
  LateSubmissionUploaded: { icon: FileUp, tone: 'bg-warning-soft text-warning' },
  ReviewStarted: { icon: ListChecks, tone: 'bg-brand-soft text-brand' },
  ReviewApproved: { icon: CheckCircle2, tone: 'bg-success-soft text-success' },
  ReviewNeedsRework: { icon: RotateCcw, tone: 'bg-warning-soft text-warning' },
  MarkedOverdue: { icon: Clock3, tone: 'bg-danger-soft text-danger' },
  Cancelled: { icon: XCircle, tone: 'bg-danger-soft text-danger' },
};

/** TaskEvent.EventType из ТЗ (Приложение F) — только события, реально существующие в модели (раздел 20 промпта). */
export function AssignmentHistorySection({ events }: { events: TaskEventEntry[] }): JSX.Element {
  if (events.length === 0) {
    return <EmptyState icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />} title="История пуста" description="Событий по этому заданию пока нет." />;
  }

  return (
    <ol className="space-y-0.5">
      {events.map((entry, index) => {
        const meta = KIND_META[entry.kind];
        const Icon = meta.icon;
        const isLast = index === events.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-divider" /> : null}
            <span aria-hidden="true" className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] font-medium text-ink">{entry.label}</p>
              {entry.detail !== undefined ? <p className="mt-0.5 text-[12px] text-ink-secondary">{entry.detail}</p> : null}
              <p className="mt-1 text-[11.5px] text-ink-muted">
                {entry.actorName} ·{' '}
                <Tooltip content={entry.absoluteLabel} placement="top">
                  <span className="cursor-default">{entry.relativeTime}</span>
                </Tooltip>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

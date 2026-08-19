import { CheckCircle2, ClipboardList, History, PlayCircle, Repeat, Upload, Wrench, XCircle } from 'lucide-react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';

import { formatRelative } from '../mentor/scope/mentorDateFormat';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { LeadTaskEventRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import type { RecentActivityItem } from './useMentorDashboard';

type EventKind = LeadTaskEventRecord['kind'];

const EVENT_ICON: Partial<Record<EventKind, ComponentType<{ className?: string }>>> = {
  DraftCreated: ClipboardList,
  Assigned: ClipboardList,
  SubmissionUploaded: Upload,
  LateSubmissionUploaded: Upload,
  ReviewStarted: PlayCircle,
  ReviewApproved: CheckCircle2,
  ReviewNeedsRework: Wrench,
  MarkedOverdue: History,
  Cancelled: XCircle,
  Reassigned: Repeat,
};

const EVENT_TONE: Partial<Record<EventKind, string>> = {
  DraftCreated: 'text-ink-secondary bg-surface-muted',
  Assigned: 'text-ink-secondary bg-surface-muted',
  SubmissionUploaded: 'text-info bg-info-soft',
  LateSubmissionUploaded: 'text-danger bg-danger-soft',
  ReviewStarted: 'text-brand bg-brand-soft',
  ReviewApproved: 'text-success bg-success-soft',
  ReviewNeedsRework: 'text-warning bg-warning-soft',
  MarkedOverdue: 'text-danger bg-danger-soft',
  Cancelled: 'text-ink-disabled bg-surface-muted',
  Reassigned: 'text-ink-secondary bg-surface-muted',
};

const DEFAULT_ICON = History;
const DEFAULT_TONE = 'text-ink-secondary bg-surface-muted';

/** «Последняя активность» — плоская хронологическая лента событий по собственным заданиям (никаких графиков — только события). */
export function RecentActivityCard({ items }: { items: RecentActivityItem[] }): JSX.Element {
  const navigate = useNavigate();

  return (
    <Card padded={false} className="flex h-full min-w-0 flex-col">
      <div className="border-b border-divider px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold leading-5 text-ink">Последняя активность</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">События по вашим заданиям</p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<History className="h-5 w-5" aria-hidden="true" />} title="Пока нет активности" description="Здесь появятся события по мере работы над заданиями." />
      ) : (
        <ul className="divide-y divide-divider">
          {items.map((item) => {
            const Icon = EVENT_ICON[item.kind] ?? DEFAULT_ICON;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { navigate(item.targetPath); }}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${EVENT_TONE[item.kind] ?? DEFAULT_TONE}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-5 text-ink">
                      <span className="font-medium">{item.label}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-muted" title={item.assignmentTitle}>{item.assignmentTitle}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] text-ink-disabled">{formatRelative(item.occurredAt).label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { LEAD_STATUS_META } from '../lead/assignments/leadAssignmentPresentation';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/leadAssignments.preview';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { PriorityQueueItem } from './useLeadDashboard';

const REASON_ICON_TONE: Record<PriorityQueueItem['reason'], string> = {
  overdue: 'text-danger',
  'waiting-review': 'text-info',
  'rework-due-soon': 'text-warning',
  'in-review-long': 'text-brand',
};

/** Мягкий soft-фон пилюли статуса — отдельные `-soft` токены, а не opacity-модификатор (тот же класс не компилируется с CSS-var цветами). */
const STATUS_PILL_BG: Record<PriorityQueueItem['status'], string> = {
  Draft: 'bg-surface-muted',
  Suggested: 'bg-info-soft',
  Assigned: 'bg-surface-muted',
  Submitted: 'bg-info-soft',
  InReview: 'bg-brand-soft',
  NeedsRework: 'bg-warning-soft',
  Overdue: 'bg-danger-soft',
  Approved: 'bg-success-soft',
  Cancelled: 'bg-surface-muted',
};

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/** «Требуют внимания» — до 7 самых срочных заданий категории, клик открывает то же detail/review UI, что и обычная страница (раздел 14 задачи Phase 3). */
export function PriorityQueueCard({ items }: { items: PriorityQueueItem[] }): JSX.Element {
  const navigate = useNavigate();

  return (
    <Card padded={false} className="flex h-full min-w-0 flex-col">
      <div className="border-b border-divider px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold leading-5 text-ink">Требуют внимания</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">Самые срочные задания вашего направления</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
          title="Нет заданий, требующих внимания"
          description="Все задачи направления в порядке — нет просроченных, забытых на проверке или срочных доработок."
        />
      ) : (
        <ul className="divide-y divide-divider">
          {items.map((item) => {
            const meta = LEAD_STATUS_META[item.status];
            return (
              <li key={item.assignmentId}>
                <button
                  type="button"
                  onClick={() => { navigate(item.targetPath); }}
                  className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                    {initialsOf(item.mentorName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold leading-5 text-ink" title={item.title}>{item.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-muted">{item.mentorName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${STATUS_PILL_BG[item.status]}`}
                      role="status"
                      aria-label={`Статус: ${LEAD_ASSIGNMENT_STATUS_LABEL[item.status]}`}
                    >
                      <span aria-hidden="true" className={`h-[6px] w-[6px] shrink-0 rounded-full ${meta.dot}`} />
                      <span className={`text-[12px] font-medium ${meta.text}`}>{LEAD_ASSIGNMENT_STATUS_LABEL[item.status]}</span>
                    </span>
                    <p className={`mt-1 text-[11.5px] font-medium ${REASON_ICON_TONE[item.reason]}`}>{item.detailLabel}</p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-ink-disabled transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-muted"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

import { History } from 'lucide-react';
import type { ReactNode } from 'react';

import { ASSIGNMENT_STATUS_LABEL, type PreviewAssignmentStatus } from '../../mocks/ui-preview/assignments.preview';
import { Button } from '../../shared/ui/Button';
import { Tooltip } from '../../shared/overlays';
import { branchDisplayName, formatDeadlineInline } from './assignmentPresentation';
import type { PreviewAssignmentDetails } from './assignmentPresentation';

export const ASSIGNMENT_STATUS_META: Record<PreviewAssignmentStatus, { dot: string; text: string }> = {
  Assigned: { dot: 'bg-ink-disabled', text: 'text-ink-secondary' },
  Submitted: { dot: 'bg-info', text: 'text-info' },
  InReview: { dot: 'bg-brand', text: 'text-brand' },
  NeedsRework: { dot: 'bg-warning', text: 'text-warning' },
  Overdue: { dot: 'bg-danger', text: 'text-danger' },
  Approved: { dot: 'bg-success', text: 'text-success' },
};

function DetailRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export interface AssignmentOverviewSectionProps {
  assignment: PreviewAssignmentDetails;
  onOpenDeadlineHistory: () => void;
}

/** Дедлайн — человекочитаемая фраза, не raw UTC (раздел 15 промпта); timezone поясняется tooltip'ом. */
export function AssignmentOverviewSection({ assignment, onOpenDeadlineHistory }: AssignmentOverviewSectionProps): JSX.Element {
  const meta = ASSIGNMENT_STATUS_META[assignment.status];

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-[20px] text-ink-secondary">{assignment.description}</p>

      <dl className="divide-y divide-divider px-0.5">
        <DetailRow
          label="Статус"
          value={
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${meta.dot}`} />
              <span className={meta.text}>{ASSIGNMENT_STATUS_LABEL[assignment.status]}</span>
            </span>
          }
        />
        <DetailRow label="Ментор" value={assignment.mentorName} />
        <DetailRow label="Филиал" value={branchDisplayName(assignment.branchName)} />
        <DetailRow label="Направление" value={assignment.categoryName} />
        <DetailRow label="Источник" value={assignment.source} />
        <DetailRow label="Назначил" value={assignment.assignedByName} />
        <DetailRow label="Назначено" value={assignment.assignedAtLabel} />
        <DetailRow
          label="Текущий дедлайн"
          value={
            <Tooltip content={`Часовой пояс направления: ${assignment.categoryName === 'UI/UX Design' ? 'Asia/Dushanbe' : 'Asia/Dushanbe'}`} placement="top">
              <span className="cursor-default">{formatDeadlineInline(assignment.currentDueLabel)}</span>
            </Tooltip>
          }
        />
        {assignment.completedAtLabel !== null ? <DetailRow label="Завершено" value={assignment.completedAtLabel} /> : null}
        <DetailRow label="Приём после дедлайна" value={assignment.allowLateSubmission ? 'Разрешён' : 'Запрещён'} />
      </dl>

      <Button variant="secondary" size="sm" leadingIcon={<History className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onOpenDeadlineHistory}>
        История изменений дедлайна
      </Button>
    </div>
  );
}

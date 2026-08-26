import { UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Drawer } from '../../../shared/overlays';
import { Badge } from '../../../shared/ui/Badge';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../../mocks/ui-preview/leadAssignments.preview';
import { LEAD_STATUS_META } from '../assignments/leadAssignmentPresentation';
import type { MentorDirectoryEntry } from '../scope/leadWorkspace';
import { useLeadScope } from '../scope/useLeadScope';
import { useScopedLeadAssignments } from '../scope/useScopedLeadAssignments';
import type { RealLeadMentor } from '../scope/useScopedLeadMentors';

export interface MentorDetailsDrawerProps {
  mentor: RealLeadMentor | undefined;
  mentorId: string | null;
  onClose: () => void;
}

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

const STATUS_LABEL: Record<MentorDirectoryEntry['status'], string> = { Active: 'Активен', Invited: 'Приглашён', Locked: 'Заблокирован' };
const STATUS_TONE: Record<MentorDirectoryEntry['status'], 'success' | 'neutral' | 'danger'> = { Active: 'success', Invited: 'neutral', Locked: 'danger' };

/**
 * Lean read-only профиль ментора для Lead (раздел 31 задачи Phase 3) —
 * НЕ переиспользует Admin `UserDetailsDrawer`: у Lead нет блокировки,
 * смены роли, перевода филиала и других admin-only действий, а прямое
 * переиспользование того компонента рисковало бы протащить их в UI по
 * инерции. Здесь только профиль + сводка по заданиям своей категории.
 */
export function MentorDetailsDrawer({ mentor, mentorId, onClose }: MentorDetailsDrawerProps): JSX.Element {
  const scope = useLeadScope();
  const navigate = useNavigate();
  const assignments = useScopedLeadAssignments().filter((a) => mentor !== undefined && a.mentorId === mentor.id);

  const open = mentorId !== null;
  const active = assignments.filter((a) => ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'].includes(a.status));
  const approved = assignments.filter((a) => a.status === 'Approved');

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={mentor?.fullName ?? 'Ментор'} size="md">
      {mentorId === null ? null : mentor === undefined ? (
        <EmptyState icon={<UserX className="h-5 w-5" aria-hidden="true" />} title="Ментор недоступен" description="Он не найден в вашем направлении." />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[15px] font-semibold text-brand">
              {initialsOf(mentor.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{mentor.fullName}</p>
              <p className="truncate text-[12.5px] text-ink-muted">{mentor.email}</p>
            </div>
            <Badge tone={STATUS_TONE[mentor.status]} className="ml-auto shrink-0">{STATUS_LABEL[mentor.status]}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-control border border-line p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Направление</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{scope.categoryName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Филиал</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{scope.branchDisplayName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">В работе</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{active.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Одобрено всего</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{approved.length}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Последний вход</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{mentor.lastLoginLabel}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[13.5px] font-semibold text-ink">Задания ({assignments.length})</h3>
            {assignments.length === 0 ? (
              <p className="text-[13px] text-ink-muted">У ментора пока нет заданий.</p>
            ) : (
              <ul className="divide-y divide-divider rounded-control border border-line">
                {assignments.map((a) => {
                  const meta = LEAD_STATUS_META[a.status];
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => { navigate(`/lead/assignments?assignmentId=${a.id}`); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                      >
                        <span aria-hidden="true" className={`h-[6px] w-[6px] shrink-0 rounded-full ${meta.dot}`} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.title}</span>
                        <span className={`shrink-0 text-[11.5px] font-medium ${meta.text}`}>{LEAD_ASSIGNMENT_STATUS_LABEL[a.status]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

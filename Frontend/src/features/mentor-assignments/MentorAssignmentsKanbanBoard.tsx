import { Clock3 } from 'lucide-react';
import { useMemo } from 'react';

import { MENTOR_KANBAN_LANES, mentorKanbanLaneOf } from '../mentor/assignments/mentorAssignmentKanban';
import { MENTOR_ASSIGNMENT_STATUS_LABEL, MENTOR_STATUS_META, latestSubmission } from '../mentor/assignments/mentorAssignmentPresentation';
import { formatCategoryDateTime, formatRelative } from '../mentor/scope/mentorDateFormat';
import type { MentorAssignmentRecord } from '../mentor/assignments/mentorAssignmentPresentation';

const THIN_SCROLLBAR_X = '[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong';
const THIN_SCROLLBAR_Y = '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong';

interface MentorAssignmentsKanbanBoardProps {
  assignments: MentorAssignmentRecord[];
  timeZoneId: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
}

interface KanbanCardProps {
  assignment: MentorAssignmentRecord;
  timeZoneId: string;
  selected: boolean;
  onOpen: (id: string) => void;
}

function KanbanCard({ assignment: a, timeZoneId, selected, onOpen }: KanbanCardProps): JSX.Element {
  const latest = latestSubmission(a);
  const statusMeta = MENTOR_STATUS_META[a.status];
  const cancelled = a.status === 'Cancelled';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { onOpen(a.id); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(a.id); } }}
      className={`flex cursor-pointer flex-col gap-2.5 rounded-control border bg-surface p-3.5 shadow-surface outline-none transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        selected ? 'border-brand bg-brand-soft' : 'border-line'
      } ${cancelled ? 'opacity-60' : ''}`}
    >
      <p className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-ink" title={a.title}>
        {a.title}
      </p>

      {latest?.isLate === true ? (
        <span className="inline-flex w-fit items-center rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">
          Сдано с опозданием
        </span>
      ) : null}

      <div className="space-y-1.5 border-t border-divider pt-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex min-w-0 items-center gap-1 truncate text-[11px] tabular-nums ${a.status === 'Overdue' ? 'font-semibold text-danger' : 'text-ink-muted'}`}
            title={formatCategoryDateTime(a.currentDueAt, timeZoneId)}
          >
            <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
            {formatRelative(a.currentDueAt).label}
          </span>
          {latest !== undefined ? (
            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink-secondary">
              v{latest.versionNumber}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-[6px] w-[6px] shrink-0 rounded-full ${statusMeta.dot}`} />
          <span className={`truncate text-[11.5px] font-medium ${statusMeta.text}`}>{MENTOR_ASSIGNMENT_STATUS_LABEL[a.status]}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * `/mentor/tasks` — единственный workflow-view (ТЗ 2.2 не описывает
 * отдельный табличный режим; Kanban — рабочее пространство, а не витрина).
 * Колонка = lane из `MENTOR_KANBAN_LANES` (тот же группинг статусов, что и
 * Lead-доска — `getAssignmentKanbanLane`), карточка перемещается между
 * колонками только по факту смены `assignment.status`. Никакого
 * drag-and-drop: Mentor не может менять статус вручную — единственный
 * доступный переход выполняется через форму отправки решения внутри
 * `MentorAssignmentDetailsDrawer` (`submitPreview`), а не перетаскиванием
 * карточки. Горизонтальный скролл — только внутри самой доски
 * (`overflow-x-auto` на обёртке), никогда на странице целиком.
 */
export function MentorAssignmentsKanbanBoard({ assignments, timeZoneId, selectedId, onOpen }: MentorAssignmentsKanbanBoardProps): JSX.Element {
  const byLane = useMemo(() => {
    const map = new Map<string, MentorAssignmentRecord[]>();
    for (const lane of MENTOR_KANBAN_LANES) map.set(lane.id, []);
    for (const a of assignments) map.get(mentorKanbanLaneOf(a))?.push(a);
    return map;
  }, [assignments]);

  return (
    <div className={`flex gap-4 overflow-x-auto pb-3 ${THIN_SCROLLBAR_X}`}>
      {MENTOR_KANBAN_LANES.map((lane) => {
        const items = byLane.get(lane.id) ?? [];
        return (
          <div key={lane.id} className="flex w-[260px] shrink-0 flex-col rounded-panel border border-line bg-app-subtle">
            <div className="flex shrink-0 items-center justify-between gap-2 rounded-t-panel border-b border-line px-3.5 py-3">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${lane.dot}`} />
                <span className="truncate text-[12.5px] font-semibold text-ink">{lane.title}</span>
              </span>
              <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted">
                {items.length}
              </span>
            </div>

            <div className={`flex-1 space-y-2 overflow-y-auto p-2.5 max-h-[70vh] ${THIN_SCROLLBAR_Y}`}>
              {items.length === 0 ? (
                <p className="px-1.5 py-4 text-center text-[11.5px] text-ink-disabled">Нет заданий</p>
              ) : (
                items.map((a) => (
                  <KanbanCard key={a.id} assignment={a} timeZoneId={timeZoneId} selected={a.id === selectedId} onOpen={onOpen} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

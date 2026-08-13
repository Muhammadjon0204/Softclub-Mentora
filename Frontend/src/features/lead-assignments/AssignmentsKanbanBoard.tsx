import { Calendar, Clock3, UserRound } from 'lucide-react';
import { useMemo } from 'react';

import { KANBAN_LANES, getAssignmentKanbanLane } from '../lead/assignments/leadAssignmentKanban';
import { LEAD_STATUS_META, pluralizeRu, sourceLabel } from '../lead/assignments/leadAssignmentPresentation';
import { formatCategoryDateTime, formatRelative, leadNow } from '../lead/scope/leadDateFormat';
import { mentorNameOf } from '../lead/scope/leadScopedData';
import { DAY_MS, HOUR_MS } from '../../mocks/domain/reference';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/leadAssignments.preview';
import { PreviewActionMenu } from '../admin-preview/PreviewActionMenu';
import type { PreviewActionMenuItem } from '../admin-preview/PreviewActionMenu';

const THIN_SCROLLBAR_X = '[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong';
const THIN_SCROLLBAR_Y = '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong';

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/** «Просрочено на N дней/часов» — не derived-статус (см. `leadAssignmentKanban.ts`), только форматирование существующего `OverdueAt`/`CurrentDueAt`. */
function overdueLabel(a: LeadAssignmentRecord): string {
  const since = a.overdueAt ?? a.currentDueAt;
  const diff = Math.max(0, leadNow() - since);
  if (diff < HOUR_MS) return 'Просрочено только что';
  if (diff < DAY_MS) {
    const hours = Math.max(1, Math.round(diff / HOUR_MS));
    return `Просрочено на ${String(hours)} ${pluralizeRu(hours, 'час', 'часа', 'часов')}`;
  }
  const days = Math.round(diff / DAY_MS);
  return `Просрочено на ${String(days)} ${pluralizeRu(days, 'день', 'дня', 'дней')}`;
}

interface AssignmentsKanbanBoardProps {
  assignments: LeadAssignmentRecord[];
  categoryId: string;
  timeZoneId: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
  getActionItems: (assignment: LeadAssignmentRecord) => PreviewActionMenuItem[];
}

interface KanbanCardProps {
  assignment: LeadAssignmentRecord;
  categoryId: string;
  timeZoneId: string;
  selected: boolean;
  onOpen: (id: string) => void;
  actionItems: PreviewActionMenuItem[];
}

function KanbanCard({ assignment: a, categoryId, timeZoneId, selected, onOpen, actionItems }: KanbanCardProps): JSX.Element {
  const latest = a.submissions[a.submissions.length - 1];
  const isOverdue = a.status === 'Overdue';
  const statusMeta = LEAD_STATUS_META[a.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { onOpen(a.id); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(a.id); } }}
      className={`group flex cursor-pointer flex-col gap-2.5 rounded-control border bg-surface p-3.5 shadow-surface outline-none transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        selected ? 'border-brand bg-brand-soft' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink-muted">
          {a.source === 'Auto' ? <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" /> : <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />}
          <span className="truncate">{sourceLabel(a.source)}</span>
        </span>
        <div className="-mr-1 -mt-1 shrink-0 p-1" onClick={(event) => { event.stopPropagation(); }}>
          <PreviewActionMenu items={actionItems} />
        </div>
      </div>

      <p className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-ink" title={a.title}>
        {a.title}
      </p>

      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-semibold text-brand">
          {initialsOf(mentorNameOf(categoryId, a.mentorId))}
        </span>
        <span className="truncate text-[12px] font-medium text-ink-secondary">{mentorNameOf(categoryId, a.mentorId)}</span>
      </div>

      {latest?.isLate === true ? (
        <span className="inline-flex w-fit items-center rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">
          Сдано с опозданием
        </span>
      ) : null}

      <div className="space-y-1.5 border-t border-divider pt-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex min-w-0 items-center gap-1 truncate text-[11px] tabular-nums ${isOverdue ? 'font-semibold text-danger' : 'text-ink-muted'}`}
            title={formatCategoryDateTime(a.currentDueAt, timeZoneId)}
          >
            <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
            {isOverdue ? overdueLabel(a) : formatRelative(a.currentDueAt).label}
          </span>
          {latest !== undefined ? (
            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink-secondary">
              v{latest.versionNumber}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-[6px] w-[6px] shrink-0 rounded-full ${statusMeta.dot}`} />
          <span className={`truncate text-[11.5px] font-medium ${statusMeta.text}`}>{LEAD_ASSIGNMENT_STATUS_LABEL[a.status]}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Kanban — единственный workflow-view `/lead/assignments`. Колонка = lane из
 * `KANBAN_LANES` (несколько domain-статусов на lane допустимы, см. модуль
 * `leadAssignmentKanban.ts`), карточка попадает туда исключительно по
 * `assignment.status` — поэтому смена статуса через drawer/action-меню
 * автоматически "переносит" карточку между lanes без drag-and-drop и без
 * параллельного источника истины (раздел J/K промпта: полуавтоматический
 * Kanban, а не произвольный DnD).
 */
export function AssignmentsKanbanBoard({
  assignments,
  categoryId,
  timeZoneId,
  selectedId,
  onOpen,
  getActionItems,
}: AssignmentsKanbanBoardProps): JSX.Element {
  const byLane = useMemo(() => {
    const map = new Map<string, LeadAssignmentRecord[]>();
    for (const lane of KANBAN_LANES) map.set(lane.id, []);
    for (const a of assignments) map.get(getAssignmentKanbanLane(a))?.push(a);
    return map;
  }, [assignments]);

  return (
    <div className={`flex gap-4 overflow-x-auto pb-3 ${THIN_SCROLLBAR_X}`}>
      {KANBAN_LANES.map((lane) => {
        const items = byLane.get(lane.id) ?? [];
        return (
          <div key={lane.id} className="flex w-[280px] shrink-0 flex-col rounded-panel border border-line bg-app-subtle">
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
                  <KanbanCard
                    key={a.id}
                    assignment={a}
                    categoryId={categoryId}
                    timeZoneId={timeZoneId}
                    selected={a.id === selectedId}
                    onOpen={onOpen}
                    actionItems={getActionItems(a)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

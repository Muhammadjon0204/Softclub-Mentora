import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Calendar, Clock3, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { KanbanDragAction, KanbanLaneId } from '../lead/assignments/leadAssignmentKanban';
import { KANBAN_LANES, getAssignmentKanbanLane, resolveKanbanDragAction } from '../lead/assignments/leadAssignmentKanban';
import { LEAD_STATUS_META, pluralizeRu, sourceLabel } from '../lead/assignments/leadAssignmentPresentation';
import { formatCategoryDateTime, formatRelative, leadNow } from '../lead/scope/leadDateFormat';
import { DAY_MS, HOUR_MS } from '../../mocks/domain/reference';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/leadAssignments.preview';
import { PreviewActionMenu } from '../admin-preview/PreviewActionMenu';
import type { PreviewActionMenuItem } from '../admin-preview/PreviewActionMenu';

const THIN_SCROLLBAR_X = '[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong';
const THIN_SCROLLBAR_Y = '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong';
const CARD_BASE = 'flex flex-col gap-2.5 rounded-control border bg-surface p-3.5';

// A click that lands right after a drop (pointer released over the card it started on) is the tail of
// the drag gesture, not a request to open the drawer.
const CLICK_AFTER_DRAG_GRACE_MS = 250;

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
  timeZoneId: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
  getActionItems: (assignment: LeadAssignmentRecord) => PreviewActionMenuItem[];
  mentorNameOf: (mentorId: string) => string;
  /** Карточку перетащили на новую lane, и `resolveKanbanDragAction` признал переход допустимым. */
  onDropAction: (assignment: LeadAssignmentRecord, action: KanbanDragAction) => void;
}

interface KanbanCardBodyProps {
  assignment: LeadAssignmentRecord;
  timeZoneId: string;
  mentorNameOf: (mentorId: string) => string;
  actionSlot: ReactNode;
}

/** Содержимое карточки без поведения — общее для карточки в колонке и её копии, летящей за курсором. */
function KanbanCardBody({ assignment: a, timeZoneId, mentorNameOf, actionSlot }: KanbanCardBodyProps): JSX.Element {
  const latest = a.submissions[a.submissions.length - 1];
  const isOverdue = a.status === 'Overdue';
  const statusMeta = LEAD_STATUS_META[a.status];

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink-muted">
          {a.source === 'Auto' ? <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" /> : <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />}
          <span className="truncate">{sourceLabel(a.source)}</span>
        </span>
        {actionSlot}
      </div>

      <p className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-ink" title={a.title}>
        {a.title}
      </p>

      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-semibold text-brand">
          {initialsOf(mentorNameOf(a.mentorId))}
        </span>
        <span className="truncate text-[12px] font-medium text-ink-secondary">{mentorNameOf(a.mentorId)}</span>
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
    </>
  );
}

interface KanbanCardProps {
  assignment: LeadAssignmentRecord;
  timeZoneId: string;
  selected: boolean;
  onOpen: (id: string) => void;
  actionItems: PreviewActionMenuItem[];
  mentorNameOf: (mentorId: string) => string;
  /** Есть ли хоть одна lane, куда эту карточку можно перетащить. */
  draggable: boolean;
}

/**
 * Вся карточка — и кнопка открытия drawer'а (клик), и то, что тащат (нажать и повести). Их различает
 * порог PointerSensor в 6px: клик без движения открывает drawer, движение начинает перетаскивание.
 * Сама карточка при этом остаётся на месте полупрозрачной — за курсором летит её копия из `DragOverlay`,
 * иначе она обрезалась бы скроллом своей колонки, как только выходит за её край.
 */
function KanbanCard({ assignment: a, timeZoneId, selected, onOpen, actionItems, mentorNameOf, draggable }: KanbanCardProps): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: a.id, disabled: !draggable });

  return (
    <div
      ref={setNodeRef}
      // Only when draggable: dnd-kit's attributes carry `aria-disabled` for a disabled draggable, which
      // would announce a perfectly clickable card as a disabled button.
      {...(draggable ? attributes : {})}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-roledescription={draggable ? 'перетаскиваемая карточка' : undefined}
      title={draggable ? 'Нажмите, чтобы открыть, или перетащите в другую колонку' : undefined}
      onClick={() => { onOpen(a.id); }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(a.id); }
      }}
      className={`group ${CARD_BASE} cursor-pointer select-none shadow-surface outline-none transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        selected ? 'border-brand bg-brand-soft' : 'border-line'
      } ${isDragging ? 'border-dashed opacity-40 shadow-none' : 'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-surface-hover'}`}
    >
      <KanbanCardBody
        assignment={a}
        timeZoneId={timeZoneId}
        mentorNameOf={mentorNameOf}
        actionSlot={
          <div className="-mr-1 -mt-1 shrink-0 p-1" onClick={(event) => { event.stopPropagation(); }}>
            <PreviewActionMenu items={actionItems} />
          </div>
        }
      />
    </div>
  );
}

interface KanbanLaneProps {
  laneId: KanbanLaneId;
  title: string;
  dot: string;
  items: LeadAssignmentRecord[];
  /** `'none'`, пока ничего не перетаскивается. */
  dropState: 'none' | 'valid' | 'invalid';
  timeZoneId: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
  getActionItems: (assignment: LeadAssignmentRecord) => PreviewActionMenuItem[];
  mentorNameOf: (mentorId: string) => string;
  isCardDraggable: (assignment: LeadAssignmentRecord) => boolean;
}

/** Одна колонка = один droppable-контейнер dnd-kit. */
function KanbanLane({
  laneId,
  title,
  dot,
  items,
  dropState,
  timeZoneId,
  selectedId,
  onOpen,
  getActionItems,
  mentorNameOf,
  isCardDraggable,
}: KanbanLaneProps): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: laneId });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[280px] shrink-0 flex-col rounded-panel border bg-app-subtle transition-colors duration-150 ${
        dropState === 'valid'
          ? isOver
            ? 'border-brand bg-brand-soft/40'
            : 'border-dashed border-brand/40'
          : dropState === 'invalid' && isOver
            ? 'border-danger/50'
            : 'border-line'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-t-panel border-b border-line px-3.5 py-3">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`} />
          <span className="truncate text-[12.5px] font-semibold text-ink">{title}</span>
        </span>
        <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted">
          {items.length}
        </span>
      </div>

      <div className={`max-h-[70vh] flex-1 space-y-2 overflow-y-auto p-2.5 ${THIN_SCROLLBAR_Y}`}>
        {items.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-[11.5px] text-ink-disabled">
            {dropState === 'valid' ? 'Отпустите здесь' : 'Нет заданий'}
          </p>
        ) : (
          items.map((a) => (
            <KanbanCard
              key={a.id}
              assignment={a}
              timeZoneId={timeZoneId}
              selected={a.id === selectedId}
              onOpen={onOpen}
              actionItems={getActionItems(a)}
              mentorNameOf={mentorNameOf}
              draggable={isCardDraggable(a)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Kanban — единственный workflow-view `/lead/assignments`. Колонка = lane из
 * `KANBAN_LANES` (несколько domain-статусов на lane допустимы, см. модуль
 * `leadAssignmentKanban.ts`), карточка попадает туда по `assignment.status`.
 *
 * Перетаскивание (2026-09-28) — не параллельный источник истины: `onDragEnd`
 * только вызывает `resolveKanbanDragAction` (ту же таблицу переходов, что и
 * action-меню) и передаёт результат наверх через `onDropAction` — саму мутацию
 * и её диалоги (например причину отмены) выполняет и решает вызывающая
 * страница, так же, как для клика по пункту меню. Ход, для которого нет
 * действия (например перетащить сразу в "Одобрено"), просто не считается
 * валидным dropzone и не срабатывает — решения проверки по-прежнему только на
 * `/lead/review-queue`, где перед решением видно содержимое Submission.
 * С клавиатуры те же переходы доступны через action-меню карточки.
 */
export function AssignmentsKanbanBoard({
  assignments,
  timeZoneId,
  selectedId,
  onOpen,
  getActionItems,
  mentorNameOf,
  onDropAction,
}: AssignmentsKanbanBoardProps): JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);
  const suppressClickUntil = useRef(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byId = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);
  const byLane = useMemo(() => {
    const map = new Map<string, LeadAssignmentRecord[]>();
    for (const lane of KANBAN_LANES) map.set(lane.id, []);
    for (const a of assignments) map.get(getAssignmentKanbanLane(a))?.push(a);
    return map;
  }, [assignments]);

  const activeAssignment = activeId !== null ? (byId.get(activeId) ?? null) : null;

  const validTargetLanes = useMemo(() => {
    if (activeAssignment === null) return new Set<KanbanLaneId>();
    const valid = new Set<KanbanLaneId>();
    for (const lane of KANBAN_LANES) {
      if (resolveKanbanDragAction(activeAssignment, lane.id) !== null) valid.add(lane.id);
    }
    return valid;
  }, [activeAssignment]);

  function isCardDraggable(a: LeadAssignmentRecord): boolean {
    return KANBAN_LANES.some((lane) => resolveKanbanDragAction(a, lane.id) !== null);
  }

  function openCard(id: string): void {
    if (Date.now() < suppressClickUntil.current) return;
    onOpen(id);
  }

  function finishDrag(): void {
    setActiveId(null);
    suppressClickUntil.current = Date.now() + CLICK_AFTER_DRAG_GRACE_MS;
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent): void {
    finishDrag();
    const { active, over } = event;
    if (over === null) return;

    const assignment = byId.get(String(active.id));
    if (assignment === undefined) return;

    const action = resolveKanbanDragAction(assignment, over.id as KanbanLaneId);
    if (action === null) return;

    onDropAction(assignment, action);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={finishDrag}
    >
      <div className={`flex gap-4 overflow-x-auto pb-3 ${THIN_SCROLLBAR_X}`}>
        {KANBAN_LANES.map((lane) => (
          <KanbanLane
            key={lane.id}
            laneId={lane.id}
            title={lane.title}
            dot={lane.dot}
            items={byLane.get(lane.id) ?? []}
            dropState={activeId === null ? 'none' : validTargetLanes.has(lane.id) ? 'valid' : 'invalid'}
            timeZoneId={timeZoneId}
            selectedId={selectedId}
            onOpen={openCard}
            getActionItems={getActionItems}
            mentorNameOf={mentorNameOf}
            isCardDraggable={isCardDraggable}
          />
        ))}
      </div>

      {/* Portaled to <body>: fixed positioning is still clipped by any transformed ancestor on the page.
          No drop animation: dnd-kit's default slides the copy back to the card's ORIGINAL column, which
          after a successful drop reads as "rejected" until the refetch moves the card. */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeAssignment !== null ? (
            <div className={`${CARD_BASE} h-full w-full rotate-[1.5deg] cursor-grabbing border-brand shadow-surface-hover`}>
              <KanbanCardBody assignment={activeAssignment} timeZoneId={timeZoneId} mentorNameOf={mentorNameOf} actionSlot={null} />
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

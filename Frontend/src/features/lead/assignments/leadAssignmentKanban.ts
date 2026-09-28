import type { LeadAssignmentRecord, LeadAssignmentStatus } from '../../../mocks/ui-preview/leadAssignments.preview';
import { canAcceptSuggestion, canCancel, canPublish, canReject } from './leadAssignmentPresentation';

/**
 * Presentation-only перегруппировка `LeadAssignmentStatus` (ТЗ 2.2, раздел
 * 13.1) в укрупнённые workflow-lanes Kanban `/lead/assignments`. Lane —
 * ЧИСТО display grouping: ни один статус здесь не придуман и не переименован
 * в domain-слое, `assignment.status` остаётся единственным источником
 * истины и всегда показан на карточке отдельным точным badge (см.
 * `LEAD_STATUS_META`/`LEAD_ASSIGNMENT_STATUS_LABEL`). Изменение реального
 * статуса — единственный способ переместить карточку между lanes.
 *
 * `Overdue` — настоящий persistent-статус автомата (устанавливается job'ом
 * `MarkOverdue()`, раздел 13.3 №6/14), а не derived-индикатор по дедлайну,
 * поэтому у него своя lane, а не просто цветной маркер внутри «Назначено».
 */
export type KanbanLaneId = 'preparation' | 'assigned' | 'review' | 'rework' | 'overdue' | 'done' | 'cancelled';

export interface KanbanLaneDef {
  id: KanbanLaneId;
  title: string;
  statuses: LeadAssignmentStatus[];
  dot: string;
}

export const KANBAN_LANES: KanbanLaneDef[] = [
  { id: 'preparation', title: 'Подготовка', statuses: ['Draft', 'Suggested'], dot: 'bg-ink-disabled' },
  { id: 'assigned', title: 'Назначено', statuses: ['Assigned'], dot: 'bg-info' },
  { id: 'review', title: 'На проверке', statuses: ['Submitted', 'InReview'], dot: 'bg-brand' },
  { id: 'rework', title: 'Доработка', statuses: ['NeedsRework'], dot: 'bg-warning' },
  { id: 'overdue', title: 'Просрочено', statuses: ['Overdue'], dot: 'bg-danger' },
  { id: 'done', title: 'Завершено', statuses: ['Approved'], dot: 'bg-success' },
  { id: 'cancelled', title: 'Отменено', statuses: ['Cancelled'], dot: 'bg-ink-disabled' },
];

const STATUS_TO_LANE = KANBAN_LANES.reduce<Record<LeadAssignmentStatus, KanbanLaneId>>((acc, lane) => {
  lane.statuses.forEach((status) => { acc[status] = lane.id; });
  return acc;
}, {} as Record<LeadAssignmentStatus, KanbanLaneId>);

/** Единственное место, где статус превращается в lane — доска и любой будущий потребитель обязаны использовать именно его. */
export function getAssignmentKanbanLane(assignment: LeadAssignmentRecord): KanbanLaneId {
  return STATUS_TO_LANE[assignment.status];
}

export type KanbanDragAction = 'publish' | 'acceptSuggestion' | 'cancel' | 'reject';

/**
 * Что означало бы перетаскивание карточки в целевую lane — если вообще что-то значит. Переиспользует
 * ровно те же capability-функции (`canPublish`/`canAcceptSuggestion`/`canCancel`/`canReject`), что
 * уже определяют пункты action-меню карточки (раздел I промпта) — drag-and-drop не может сделать
 * ничего, чего не позволяет и меню, никакого параллельного набора правил.
 *
 * Решения проверки (Одобрить/На доработку) сюда намеренно не входят — они остаются только на
 * `/lead/review-queue`, где решение принимается с реальным содержимым Submission перед глазами, а не
 * вслепую перетаскиванием карточки (запрос 2026-09-28).
 */
export function resolveKanbanDragAction(
  assignment: LeadAssignmentRecord,
  targetLane: KanbanLaneId,
): KanbanDragAction | null {
  if (targetLane === getAssignmentKanbanLane(assignment)) return null;

  if (targetLane === 'assigned') {
    if (canPublish(assignment)) return 'publish';
    if (canAcceptSuggestion(assignment)) return 'acceptSuggestion';
    return null;
  }

  if (targetLane === 'cancelled') {
    if (canReject(assignment)) return 'reject';
    if (canCancel(assignment)) return 'cancel';
    return null;
  }

  return null;
}

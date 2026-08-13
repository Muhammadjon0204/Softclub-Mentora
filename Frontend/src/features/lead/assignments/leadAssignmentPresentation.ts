import { TASK_EVENT_LABEL, pluralizeRu } from '../../admin-assignments/assignmentPresentation';
import type { LeadAssignmentRecord, LeadAssignmentStatus, LeadTaskEventRecord } from '../../../mocks/ui-preview/leadAssignments.preview';

export { pluralizeRu };

/**
 * Единственный источник истины для UI о том, какие действия допустимы в
 * текущем статусе Assignment. Основано дословно на таблице переходов ТЗ 2.2,
 * раздел 13.3 / Приложение B — а не на «похоже, тут должна быть кнопка».
 * Ни одна страница/drawer Lead-раздела не должна вычислять доступность
 * действия иначе, чем через эти функции (раздел 28–29 задачи Phase 3).
 */

/**
 * Единый порядок статусов для List-табов и Kanban-колонок (Lead UI upgrade,
 * раздел 7.2–7.3). Kanban — ЧИСТО display layer поверх этого же перечисления:
 * одна колонка = один существующий `LeadAssignmentStatus`, 1:1, без единого
 * придуманного статуса ("В работе"/"Принято" и т.п. в модели нет — значит их
 * нет и в колонках). См. `AssignmentsKanbanBoard.tsx` для маппинга колонка→статус.
 */
export const LEAD_ASSIGNMENT_STATUS_ORDER: LeadAssignmentStatus[] = [
  'Draft',
  'Suggested',
  'Assigned',
  'Submitted',
  'InReview',
  'NeedsRework',
  'Overdue',
  'Approved',
  'Cancelled',
];

export const LEAD_STATUS_META: Record<LeadAssignmentStatus, { dot: string; text: string }> = {
  Draft: { dot: 'bg-ink-disabled', text: 'text-ink-secondary' },
  Suggested: { dot: 'bg-info', text: 'text-info' },
  Assigned: { dot: 'bg-ink-disabled', text: 'text-ink-secondary' },
  Submitted: { dot: 'bg-info', text: 'text-info' },
  InReview: { dot: 'bg-brand', text: 'text-brand' },
  NeedsRework: { dot: 'bg-warning', text: 'text-warning' },
  Overdue: { dot: 'bg-danger', text: 'text-danger' },
  Approved: { dot: 'bg-success', text: 'text-success' },
  Cancelled: { dot: 'bg-ink-disabled', text: 'text-ink-disabled' },
};

export function isTerminal(status: LeadAssignmentStatus): boolean {
  return status === 'Approved' || status === 'Cancelled';
}

/** Draft -> Assigned (ASN-002). */
export function canPublish(a: LeadAssignmentRecord): boolean {
  return a.status === 'Draft';
}

/** Suggested -> Assigned, принять как есть (ASN-010). */
export function canAcceptSuggestion(a: LeadAssignmentRecord): boolean {
  return a.status === 'Suggested';
}

/** Suggested -> Cancelled с обязательной причиной — «отклонить» (ASN-012). */
export function canReject(a: LeadAssignmentRecord): boolean {
  return a.status === 'Suggested';
}

/** PUT /assignments/{id} — редактирование разрешено только в Draft и Suggested (ASN-004). */
export function canEdit(a: LeadAssignmentRecord): boolean {
  return a.status === 'Draft' || a.status === 'Suggested';
}

/** Переназначение — Draft/Suggested/Assigned, и только до первой Submission (ASN-005, 10.6.3). */
export function canReassign(a: LeadAssignmentRecord): boolean {
  if (a.status === 'Draft' || a.status === 'Suggested') return true;
  return a.status === 'Assigned' && a.submissions.length === 0;
}

/** Отмена доступна из любого нетерминального статуса (ASN-006, ASN-024). */
export function canCancel(a: LeadAssignmentRecord): boolean {
  return !isTerminal(a.status);
}

/** Submitted -> InReview, явное действие Lead (REV-001). */
export function canStartReview(a: LeadAssignmentRecord): boolean {
  return a.status === 'Submitted';
}

/** Approve / NeedsRework — только из InReview, и только для последней Submission (REV-003, REV-004). */
export function canDecideReview(a: LeadAssignmentRecord): boolean {
  return a.status === 'InReview';
}

export interface AssignmentCapabilities {
  canPublish: boolean;
  canAcceptSuggestion: boolean;
  canReject: boolean;
  canEdit: boolean;
  canReassign: boolean;
  canCancel: boolean;
  canStartReview: boolean;
  canDecideReview: boolean;
  isTerminal: boolean;
}

/** Единая точка вычисления всех capability сразу — используется action-меню строк таблицы и drawer'ами. */
export function assignmentCapabilities(a: LeadAssignmentRecord): AssignmentCapabilities {
  return {
    canPublish: canPublish(a),
    canAcceptSuggestion: canAcceptSuggestion(a),
    canReject: canReject(a),
    canEdit: canEdit(a),
    canReassign: canReassign(a),
    canCancel: canCancel(a),
    canStartReview: canStartReview(a),
    canDecideReview: canDecideReview(a),
    isTerminal: isTerminal(a.status),
  };
}

export function latestSubmission(a: LeadAssignmentRecord) {
  if (a.submissions.length === 0) return undefined;
  return a.submissions[a.submissions.length - 1];
}

export function averageVersionsLabel(a: LeadAssignmentRecord): string {
  const n = a.submissions.length;
  return `${String(n)} ${pluralizeRu(n, 'версия', 'версии', 'версий')}`;
}

const EXTRA_EVENT_LABEL: Record<'SuggestionAccepted' | 'Reassigned' | 'SuggestedCreated', string> = {
  SuggestedCreated: 'Предложено планировщиком',
  SuggestionAccepted: 'Предложение принято',
  Reassigned: 'Переназначено',
};

export function taskEventLabel(event: LeadTaskEventRecord): string {
  if (event.kind in TASK_EVENT_LABEL) return TASK_EVENT_LABEL[event.kind as keyof typeof TASK_EVENT_LABEL];
  return EXTRA_EVENT_LABEL[event.kind as keyof typeof EXTRA_EVENT_LABEL];
}

export function sourceLabel(source: LeadAssignmentRecord['source']): string {
  return source === 'Auto' ? 'Из расписания' : 'Индивидуальное';
}

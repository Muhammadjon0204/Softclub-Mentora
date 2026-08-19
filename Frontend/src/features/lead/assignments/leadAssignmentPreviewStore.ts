import { useSyncExternalStore } from 'react';

import { LEAD_ASSIGNMENTS } from '../../../mocks/ui-preview/leadAssignments.preview';
import type { LeadAssignmentRecord, LeadSubmissionFile, LeadSubmissionRecord, LeadTaskEventRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { MOCK_NOW } from '../../../mocks/domain/reference';
import { canAcceptSuggestion, canCancel, canDecideReview, canEdit, canPublish, canReassign, canStartReview, canSubmit } from './leadAssignmentPresentation';

/**
 * Module-level preview-стор для Assignment (тот же приём, что
 * `admin-users/userPreviewStore.ts`): мутации живут только в памяти вкладки,
 * ничего не пишется в localStorage, ничего не уходит на настоящий backend
 * (раздел 55 задачи Phase 3 — «preview only»). Каждая мутация ЗАНОВО проверяет
 * допустимость перехода по конечному автомату (ТЗ раздел 13.3) — так же, как
 * это обязан делать backend: то, что кнопка была скрыта в UI, не единственная
 * защита (раздел 29 задачи).
 */
let assignments: LeadAssignmentRecord[] = LEAD_ASSIGNMENTS.map((a) => ({ ...a }));
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LeadAssignmentRecord[] {
  return assignments;
}

export function useLeadAssignmentsPreview(): LeadAssignmentRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export class LeadAssignmentPreviewError extends Error {}

function getScoped(categoryId: string, id: string): LeadAssignmentRecord {
  const found = assignments.find((a) => a.id === id);
  if (found === undefined || found.categoryId !== categoryId) {
    throw new LeadAssignmentPreviewError('Задание не найдено');
  }
  return found;
}

/** SUB-001: Mentor владеет Assignment только если `mentorId` совпадает — тот же anti-enumeration приём, что `getScoped` для Lead/`categoryId`. */
function getOwnedByMentor(mentorId: string, id: string): LeadAssignmentRecord {
  const found = assignments.find((a) => a.id === id);
  if (found === undefined || found.mentorId !== mentorId) {
    throw new LeadAssignmentPreviewError('Задание не найдено');
  }
  return found;
}

function patch(id: string, patcher: (a: LeadAssignmentRecord) => LeadAssignmentRecord): LeadAssignmentRecord {
  let updated: LeadAssignmentRecord | undefined;
  assignments = assignments.map((a) => {
    if (a.id !== id) return a;
    updated = patcher(a);
    return updated;
  });
  if (updated === undefined) throw new LeadAssignmentPreviewError('Задание не найдено');
  emit();
  return updated;
}

function pushEvent(a: LeadAssignmentRecord, event: Omit<LeadTaskEventRecord, 'id'>): LeadAssignmentRecord {
  const stamped: LeadTaskEventRecord = { ...event, id: `${a.id}-ev-${String(a.events.length + 1)}` };
  return { ...a, events: [...a.events, stamped] };
}

let nextAssignmentSeq = assignments.length + 1;
function nextAssignmentId(): string {
  const id = `asn-new-${String(nextAssignmentSeq)}`;
  nextAssignmentSeq += 1;
  return id;
}

/* ------------------------------------ создание/редактирование ----------------------------------- */

export interface CreateDraftInput {
  categoryId: string;
  title: string;
  description: string;
  mentorId: string;
  dueAt: number;
  leadName: string;
}

/** ASN-001: Lead создаёт Assignment в статусе Draft. */
export function createDraftPreview(input: CreateDraftInput): LeadAssignmentRecord {
  const id = nextAssignmentId();
  const created: LeadAssignmentRecord = {
    id,
    categoryId: input.categoryId,
    title: input.title.trim(),
    description: input.description.trim(),
    status: 'Draft',
    source: 'Manual',
    mentorId: input.mentorId,
    assignedById: null,
    topicAssignmentId: null,
    initialDueAt: input.dueAt,
    currentDueAt: input.dueAt,
    assignedAt: null,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [{ id: `${id}-ev-1`, kind: 'DraftCreated', occurredAt: MOCK_NOW, actorName: input.leadName }],
  };
  assignments = [created, ...assignments];
  emit();
  return created;
}

export interface EditAssignmentInput {
  title: string;
  description: string;
  mentorId: string;
  dueAt: number;
}

/** ASN-004: PUT /assignments/{id} — только Draft и Suggested. */
export function editAssignmentPreview(categoryId: string, id: string, input: EditAssignmentInput): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canEdit(existing)) throw new LeadAssignmentPreviewError('Редактирование недоступно в текущем статусе');
  return patch(id, (a) => ({
    ...a,
    title: input.title.trim(),
    description: input.description.trim(),
    mentorId: input.mentorId,
    initialDueAt: a.status === 'Draft' ? input.dueAt : a.initialDueAt,
    currentDueAt: a.status === 'Draft' ? input.dueAt : a.currentDueAt,
  }));
}

/* ----------------------------------------- переходы статуса ------------------------------------- */

/** ASN-002: Draft -> Assigned. */
export function publishPreview(categoryId: string, id: string, leadName: string): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canPublish(existing)) throw new LeadAssignmentPreviewError('Опубликовать можно только черновик');
  return patch(id, (a) =>
    pushEvent(
      { ...a, status: 'Assigned', assignedAt: MOCK_NOW, assignedById: leadName },
      { kind: 'Assigned', occurredAt: MOCK_NOW, actorName: leadName },
    ),
  );
}

/** ASN-003/ASN-010: Suggested -> Assigned, принять как есть. */
export function acceptSuggestionPreview(categoryId: string, id: string, leadName: string): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canAcceptSuggestion(existing)) throw new LeadAssignmentPreviewError('Принять можно только предложенное задание');
  return patch(id, (a) => {
    const withAccepted = pushEvent(a, { kind: 'SuggestionAccepted', occurredAt: MOCK_NOW, actorName: leadName });
    return pushEvent(
      { ...withAccepted, status: 'Assigned', assignedAt: MOCK_NOW, assignedById: leadName },
      { kind: 'Assigned', occurredAt: MOCK_NOW, actorName: leadName },
    );
  });
}

/** ASN-012: Suggested -> Cancelled с причиной — «отклонить предложение». */
export function rejectSuggestionPreview(categoryId: string, id: string, leadName: string, reason: string): LeadAssignmentRecord {
  return cancelPreview(categoryId, id, leadName, reason);
}

/** ASN-006/ASN-024: отмена из любого нетерминального статуса, причина 5–500 символов. */
export function cancelPreview(categoryId: string, id: string, leadName: string, reason: string): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canCancel(existing)) throw new LeadAssignmentPreviewError('Задание уже завершено');
  if (reason.trim().length < 5 || reason.trim().length > 500) {
    throw new LeadAssignmentPreviewError('Причина отмены должна содержать от 5 до 500 символов');
  }
  return patch(id, (a) =>
    pushEvent(
      { ...a, status: 'Cancelled', cancelledAt: MOCK_NOW, cancelReason: reason.trim() },
      { kind: 'Cancelled', occurredAt: MOCK_NOW, actorName: leadName, detail: reason.trim() },
    ),
  );
}

/** ASN-005/10.6.3: переназначение — Draft/Suggested/Assigned без Submission. */
export function reassignPreview(categoryId: string, id: string, leadName: string, mentorId: string, mentorName: string): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canReassign(existing)) throw new LeadAssignmentPreviewError('Переназначение недоступно после первой отправленной работы');
  return patch(id, (a) => pushEvent({ ...a, mentorId }, { kind: 'Reassigned', occurredAt: MOCK_NOW, actorName: leadName, detail: mentorName }));
}

/** REV-001: Submitted -> InReview. */
export function startReviewPreview(categoryId: string, id: string, leadName: string): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canStartReview(existing)) throw new LeadAssignmentPreviewError('Проверку можно начать только для отправленной работы');
  return patch(id, (a) =>
    pushEvent({ ...a, status: 'InReview', reviewStartedAt: MOCK_NOW }, { kind: 'ReviewStarted', occurredAt: MOCK_NOW, actorName: leadName }),
  );
}

/** REV-002 (Approved): InReview -> Approved, комментарий необязателен. */
export function approvePreview(categoryId: string, id: string, leadName: string, comment: string | null): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canDecideReview(existing)) throw new LeadAssignmentPreviewError('Решение можно вынести только во время проверки');
  return patch(id, (a) => {
    const submissions = a.submissions.map((submission, index) =>
      index === a.submissions.length - 1
        ? {
            ...submission,
            review: {
              id: `${submission.id}-rev`,
              decision: 'Approved' as const,
              comment: comment !== null && comment.trim().length > 0 ? comment.trim() : null,
              reworkDueAt: null,
              createdAt: MOCK_NOW,
              reviewerName: leadName,
            },
          }
        : submission,
    );
    return pushEvent(
      { ...a, status: 'Approved', approvedAt: MOCK_NOW, submissions },
      { kind: 'ReviewApproved', occurredAt: MOCK_NOW, actorName: leadName },
    );
  });
}

/** REV-002 (NeedsRework): InReview -> NeedsRework, комментарий 10–3000 симв. и reworkDueAt > now обязательны. */
export function requestReworkPreview(categoryId: string, id: string, leadName: string, comment: string, reworkDueAt: number): LeadAssignmentRecord {
  const existing = getScoped(categoryId, id);
  if (!canDecideReview(existing)) throw new LeadAssignmentPreviewError('Решение можно вынести только во время проверки');
  const trimmed = comment.trim();
  if (trimmed.length < 10 || trimmed.length > 3000) {
    throw new LeadAssignmentPreviewError('Комментарий должен содержать от 10 до 3000 символов');
  }
  if (reworkDueAt <= MOCK_NOW) {
    throw new LeadAssignmentPreviewError('Новый дедлайн обязан быть в будущем');
  }
  return patch(id, (a) => {
    const submissions = a.submissions.map((submission, index) =>
      index === a.submissions.length - 1
        ? {
            ...submission,
            review: {
              id: `${submission.id}-rev`,
              decision: 'NeedsRework' as const,
              comment: trimmed,
              reworkDueAt,
              createdAt: MOCK_NOW,
              reviewerName: leadName,
            },
          }
        : submission,
    );
    return pushEvent(
      { ...a, status: 'NeedsRework', currentDueAt: reworkDueAt, submissions },
      { kind: 'ReviewNeedsRework', occurredAt: MOCK_NOW, actorName: leadName },
    );
  });
}

/* --------------------------------------- действия Mentor ---------------------------------------- */

export interface SubmitInput {
  files: LeadSubmissionFile[];
  comment: string | null;
}

/**
 * SUB-001..SUB-004, переходы №5/13/16 таблицы 13.3: Mentor загружает
 * Submission по своему Assignment. Единственная Mentor-легальная мутация в
 * этом файле — намеренно не вынесена в отдельный mentor-стор, потому что это
 * тот же самый Assignment, который видит и решает Lead («ONE TASK», не два
 * параллельных объекта — см. `features/mentor/assignments/mentorAssignmentPreviewStore.ts`,
 * который лишь реэкспортирует эту функцию). Никогда не переводит статус
 * дальше `Submitted` — в `InReview`/`Approved`/`NeedsRework` может перевести
 * только Lead (`startReviewPreview`/`approvePreview`/`requestReworkPreview`).
 */
export function submitPreview(mentorId: string, id: string, mentorName: string, input: SubmitInput): LeadAssignmentRecord {
  const existing = getOwnedByMentor(mentorId, id);
  if (!canSubmit(existing)) throw new LeadAssignmentPreviewError('Загрузка решения недоступна в текущем статусе задания');
  if (existing.status === 'Overdue' && !existing.allowLateSubmission) {
    throw new LeadAssignmentPreviewError('Приём работ по этой задаче закрыт. Обратитесь к тимлиду.');
  }
  if (input.files.length === 0) throw new LeadAssignmentPreviewError('Прикрепите хотя бы один файл');
  const trimmedComment = input.comment !== null && input.comment.trim().length > 0 ? input.comment.trim() : null;
  const isLate = existing.status === 'Overdue';

  return patch(id, (a) => {
    const versionNumber = a.submissions.length + 1;
    const submission: LeadSubmissionRecord = {
      id: `${a.id}-sub-${String(versionNumber)}`,
      versionNumber,
      submittedAt: MOCK_NOW,
      isLate,
      comment: trimmedComment,
      files: input.files,
      review: null,
    };
    const withSubmission = {
      ...a,
      status: 'Submitted' as const,
      firstSubmittedAt: a.firstSubmittedAt ?? MOCK_NOW,
      submissions: [...a.submissions, submission],
    };
    return pushEvent(withSubmission, {
      kind: isLate ? 'LateSubmissionUploaded' : 'SubmissionUploaded',
      occurredAt: MOCK_NOW,
      actorName: mentorName,
      detail: `Версия ${String(versionNumber)}`,
    });
  });
}

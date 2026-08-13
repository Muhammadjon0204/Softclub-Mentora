import { useSyncExternalStore } from 'react';

import { LEAD_TOPICS, LEAD_TOPIC_ASSIGNMENTS } from '../../../mocks/ui-preview/leadTopics.preview';
import type { LeadTopicAssignmentRecord, LeadTopicRecord, TopicAssignmentType } from '../../../mocks/ui-preview/leadTopics.preview';
import { MOCK_NOW } from '../../../mocks/domain/reference';

/** Тот же module-level store + `useSyncExternalStore` приём, что у Assignment/Mentor (ТЗ раздел 10.4–10.5, TOPIC-/TPL- требования). */
let topics: LeadTopicRecord[] = LEAD_TOPICS.map((t) => ({ ...t }));
let topicAssignments: LeadTopicAssignmentRecord[] = LEAD_TOPIC_ASSIGNMENTS.map((t) => ({ ...t }));
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLeadTopicsPreview(): LeadTopicRecord[] {
  return useSyncExternalStore(subscribe, () => topics);
}

export function useLeadTopicAssignmentsPreview(): LeadTopicAssignmentRecord[] {
  return useSyncExternalStore(subscribe, () => topicAssignments);
}

export class LeadSchedulePreviewError extends Error {}

let nextTopicSeq = topics.length + 1;
let nextTpaSeq = topicAssignments.length + 1;

export interface CreateTopicInput {
  categoryId: string;
  dayNumber: number;
  plannedDate: number | null;
  title: string;
  description: string;
}

/** TOPIC-010: `PlannedDate` уникален среди активных Topic категории — предупреждение, а не жёсткий блок, если дата уже используется. */
export function createTopicPreview(input: CreateTopicInput): LeadTopicRecord {
  const created: LeadTopicRecord = {
    id: `top-new-${String(nextTopicSeq)}`,
    categoryId: input.categoryId,
    dayNumber: input.dayNumber,
    plannedDate: input.plannedDate ?? MOCK_NOW,
    title: input.title.trim(),
    description: input.description.trim(),
    isActive: true,
  };
  nextTopicSeq += 1;
  topics = [...topics, created].sort((a, b) => a.dayNumber - b.dayNumber);
  emit();
  return created;
}

export interface UpdateTopicInput {
  dayNumber: number;
  plannedDate: number | null;
  title: string;
  description: string;
}

export function updateTopicPreview(categoryId: string, id: string, input: UpdateTopicInput): LeadTopicRecord {
  const existing = topics.find((t) => t.id === id);
  if (existing === undefined || existing.categoryId !== categoryId) throw new LeadSchedulePreviewError('Тема не найдена');
  let updated: LeadTopicRecord = existing;
  topics = topics
    .map((t) => {
      if (t.id !== id) return t;
      updated = { ...t, dayNumber: input.dayNumber, plannedDate: input.plannedDate ?? t.plannedDate, title: input.title.trim(), description: input.description.trim() };
      return updated;
    })
    .sort((a, b) => a.dayNumber - b.dayNumber);
  emit();
  return updated;
}

/** TOPIC-013: архивирование вместо удаления — тема остаётся видимой с пометкой «архивная» и исключается из авто-генерации. */
export function setTopicActivePreview(categoryId: string, id: string, isActive: boolean): void {
  const existing = topics.find((t) => t.id === id);
  if (existing === undefined || existing.categoryId !== categoryId) throw new LeadSchedulePreviewError('Тема не найдена');
  topics = topics.map((t) => (t.id === id ? { ...t, isActive } : t));
  emit();
}

export interface UpsertTopicAssignmentInput {
  type: TopicAssignmentType;
  title: string;
  description: string;
  isRequired: boolean;
}

/** TPL-001: TopicAssignment создаётся внутри Topic своей категории, scope наследуется от Topic. */
export function createTopicAssignmentPreview(categoryId: string, topicId: string, input: UpsertTopicAssignmentInput): LeadTopicAssignmentRecord {
  const topic = topics.find((t) => t.id === topicId);
  if (topic === undefined || topic.categoryId !== categoryId) throw new LeadSchedulePreviewError('Тема не найдена');
  const created: LeadTopicAssignmentRecord = {
    id: `tpa-new-${String(nextTpaSeq)}`,
    topicId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    isRequired: input.isRequired,
    isActive: true,
  };
  nextTpaSeq += 1;
  topicAssignments = [...topicAssignments, created];
  emit();
  return created;
}

export function updateTopicAssignmentPreview(id: string, input: UpsertTopicAssignmentInput): LeadTopicAssignmentRecord {
  let updated: LeadTopicAssignmentRecord | undefined;
  topicAssignments = topicAssignments.map((tpa) => {
    if (tpa.id !== id) return tpa;
    updated = { ...tpa, type: input.type, title: input.title.trim(), description: input.description.trim(), isRequired: input.isRequired };
    return updated;
  });
  if (updated === undefined) throw new LeadSchedulePreviewError('Шаблон не найден');
  emit();
  return updated;
}

/** TPL-002/TPL-003: удаление запрещено при наличии связанных Assignment — preview архивирует (`isActive=false`) вместо удаления. */
export function setTopicAssignmentActivePreview(id: string, isActive: boolean): void {
  const exists = topicAssignments.some((tpa) => tpa.id === id);
  if (!exists) throw new LeadSchedulePreviewError('Шаблон не найден');
  topicAssignments = topicAssignments.map((tpa) => (tpa.id === id ? { ...tpa, isActive } : tpa));
  emit();
}

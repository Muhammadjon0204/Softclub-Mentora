import { LEAD_ASSIGNMENTS } from '../../../mocks/ui-preview/leadAssignments.preview';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { LEAD_TOPICS, LEAD_TOPIC_ASSIGNMENTS } from '../../../mocks/ui-preview/leadTopics.preview';
import type { LeadTopicAssignmentRecord, LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { getMentorDirectorySnapshot } from '../team/leadMentorPreviewStore';
import type { MentorDirectoryEntry } from './leadWorkspace';

/**
 * Единственная граница доступа к данным Lead-раздела (ТЗ 2.2, раздел 8.3 —
 * Category isolation). Все страницы обязаны читать данные ТОЛЬКО через эти
 * функции, а не напрямую из `mocks/ui-preview/*` — иначе изоляция превращается
 * в «`array.filter` в последнем компоненте», который легко забыть на одной из
 * страниц (см. задачу Phase 3, раздел 5). Каждый resolver дополнительно
 * проверяет `categoryId`, а не только совпадение `id` — сравнение только по
 * `id` было бы дырой: id из чужой категории тоже уникален глобально и
 * «нашёлся» бы, если бы фильтр не сверял scope.
 */

export function scopedAssignments(categoryId: string): LeadAssignmentRecord[] {
  return LEAD_ASSIGNMENTS.filter((assignment) => assignment.categoryId === categoryId);
}

/** Возвращает `undefined` и для несуществующего id, и для id из чужой категории — вызывающая страница не обязана (и не должна) их различать (anti-enumeration, ТЗ раздел 9.2). */
export function resolveScopedAssignment(categoryId: string, assignmentId: string): LeadAssignmentRecord | undefined {
  const assignment = LEAD_ASSIGNMENTS.find((item) => item.id === assignmentId);
  if (assignment === undefined || assignment.categoryId !== categoryId) return undefined;
  return assignment;
}

export function scopedMentors(categoryId: string): MentorDirectoryEntry[] {
  return getMentorDirectorySnapshot().filter((mentor) => mentor.categoryId === categoryId);
}

export function scopedActiveMentors(categoryId: string): MentorDirectoryEntry[] {
  return scopedMentors(categoryId).filter((mentor) => mentor.status !== 'Invited');
}

export function resolveScopedMentor(categoryId: string, mentorId: string): MentorDirectoryEntry | undefined {
  const mentor = getMentorDirectorySnapshot().find((item) => item.id === mentorId);
  if (mentor === undefined || mentor.categoryId !== categoryId) return undefined;
  return mentor;
}

export function scopedTopics(categoryId: string): LeadTopicRecord[] {
  return LEAD_TOPICS.filter((topic) => topic.categoryId === categoryId);
}

export function resolveScopedTopic(categoryId: string, topicId: string): LeadTopicRecord | undefined {
  const topic = LEAD_TOPICS.find((item) => item.id === topicId);
  if (topic === undefined || topic.categoryId !== categoryId) return undefined;
  return topic;
}

/** Список TopicAssignment внутри Topic — сначала проверяет, что сам Topic принадлежит scope, иначе возвращает пустой список, а не чужие шаблоны. */
export function scopedTopicAssignments(categoryId: string, topicId: string): LeadTopicAssignmentRecord[] {
  const topic = resolveScopedTopic(categoryId, topicId);
  if (topic === undefined) return [];
  return LEAD_TOPIC_ASSIGNMENTS.filter((item) => item.topicId === topicId);
}

export function mentorNameOf(categoryId: string, mentorId: string): string {
  return resolveScopedMentor(categoryId, mentorId)?.fullName ?? 'Ментор';
}

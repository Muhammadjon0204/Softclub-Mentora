import { useMemo } from 'react';

import { useLeadTopicAssignmentsPreview, useLeadTopicsPreview } from '../../lead/schedule/leadSchedulePreviewStore';
import type { LeadTopicAssignmentRecord, LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { useMentorScope } from './useMentorScope';

/**
 * Расписание (Topic/TopicAssignment) — та же категория, тот же стор, что
 * читает Lead (`features/lead/scope/useScopedLeadSchedule.ts`), но Mentor
 * никогда не мутирует его: ТЗ 8.4/Приложение A — «Просмотр расписания
 * категории: Mentor — Да (своя, чтение)», CRUD Topic/TopicAssignment
 * Mentor недоступен ни в каком виде. Нельзя переиспользовать
 * `useScopedLeadTopics()` напрямую — она вызывает `useLeadScope()`, который
 * бросает исключение вне роли Lead.
 */
export function useScopedMentorTopics(): LeadTopicRecord[] {
  const scope = useMentorScope();
  const all = useLeadTopicsPreview();
  return useMemo(() => all.filter((topic) => topic.categoryId === scope.categoryId), [all, scope.categoryId]);
}

export function useResolvedMentorTopic(topicId: string | null): LeadTopicRecord | undefined {
  const scoped = useScopedMentorTopics();
  if (topicId === null) return undefined;
  return scoped.find((topic) => topic.id === topicId);
}

export function useTopicAssignmentsOfMentor(topicId: string | null): LeadTopicAssignmentRecord[] {
  const topic = useResolvedMentorTopic(topicId);
  const all = useLeadTopicAssignmentsPreview();
  return useMemo(() => (topic === undefined ? [] : all.filter((tpa) => tpa.topicId === topic.id)), [all, topic]);
}

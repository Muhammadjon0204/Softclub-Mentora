import { useMemo } from 'react';

import { useLeadTopicAssignmentsPreview, useLeadTopicsPreview } from '../schedule/leadSchedulePreviewStore';
import type { LeadTopicAssignmentRecord, LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { useLeadScope } from './useLeadScope';

export function useScopedLeadTopics(): LeadTopicRecord[] {
  const scope = useLeadScope();
  const all = useLeadTopicsPreview();
  return useMemo(() => all.filter((topic) => topic.categoryId === scope.categoryId), [all, scope.categoryId]);
}

export function useResolvedLeadTopic(topicId: string | null): LeadTopicRecord | undefined {
  const scoped = useScopedLeadTopics();
  if (topicId === null) return undefined;
  return scoped.find((topic) => topic.id === topicId);
}

/** Список шаблонов внутри Topic — сначала проверяет scope самого Topic (та же защита, что `leadScopedData.scopedTopicAssignments`). */
export function useTopicAssignmentsOf(topicId: string | null): LeadTopicAssignmentRecord[] {
  const topic = useResolvedLeadTopic(topicId);
  const all = useLeadTopicAssignmentsPreview();
  return useMemo(() => (topic === undefined ? [] : all.filter((tpa) => tpa.topicId === topic.id)), [all, topic]);
}

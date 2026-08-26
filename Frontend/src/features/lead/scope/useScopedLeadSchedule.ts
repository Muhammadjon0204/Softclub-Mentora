import { useQueries, useQuery } from '@tanstack/react-query';

import { listTopicAssignmentsOfTopic, listTopics } from '../../../api/lead/topics';
import type { LeadTopicAssignmentRecord, LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { toTopicAssignmentRecord, toTopicRecord } from '../schedule/topicAdapter';
import { useLeadScope } from './useLeadScope';

/** Same 100-cap precedent as the other list hooks in this pass — no pagination control exists in the Schedule UI. */
const MAX_PAGE_SIZE = 100;

export function leadTopicsListQueryKey(organizationId: string, categoryId: string): readonly unknown[] {
  return ['lead-topics', 'list', organizationId, categoryId] as const;
}

export function topicAssignmentsOfTopicQueryKey(topicId: string): readonly unknown[] {
  return ['lead-topic-assignments-of-topic', topicId] as const;
}

/**
 * TP1: `GET /topics`, real replacement for `useLeadTopicsPreview()` + client-side category filter.
 * `ScheduleService.ApplyVisibility` scopes both Lead and Mentor to their own category server-side
 * (`{ Role: Lead or Mentor } => t.CategoryId == actor.CategoryId`), same pattern as Assignments.
 */
export function useScopedLeadTopics(): LeadTopicRecord[] {
  const scope = useLeadScope();
  const listQuery = useQuery({
    queryKey: leadTopicsListQueryKey(scope.organizationId, scope.categoryId),
    queryFn: () => listTopics({ pageSize: MAX_PAGE_SIZE }),
  });
  return (listQuery.data?.items ?? []).map(toTopicRecord);
}

/** TP2 (via the already-fetched list) — `undefined` for a foreign/nonexistent id. */
export function useResolvedLeadTopic(topicId: string | null): LeadTopicRecord | undefined {
  const scoped = useScopedLeadTopics();
  if (topicId === null) return undefined;
  return scoped.find((topic) => topic.id === topicId);
}

/** TP8: `GET /topics/{topicId}/assignments` — the templates of one topic. */
export function useTopicAssignmentsOf(topicId: string | null): LeadTopicAssignmentRecord[] {
  const listQuery = useQuery({
    queryKey: topicAssignmentsOfTopicQueryKey(topicId ?? 'none'),
    queryFn: () => listTopicAssignmentsOfTopic(topicId as string),
    enabled: topicId !== null,
  });
  return (listQuery.data ?? []).map(toTopicAssignmentRecord);
}

/**
 * TP8 fanned out across every topic in the list — there is no "all templates of my category" endpoint
 * (`TopicAssignmentDto` is only ever listed nested under a topic), so building the flat "topic —
 * template" option list `AssignmentForm.tsx` needs for its template picker means one `GET
 * /topics/{topicId}/assignments` per active topic. Safe to call with an empty array.
 */
export function useAllTopicAssignments(topics: LeadTopicRecord[]): LeadTopicAssignmentRecord[] {
  const results = useQueries({
    queries: topics.map((topic) => ({
      queryKey: topicAssignmentsOfTopicQueryKey(topic.id),
      queryFn: () => listTopicAssignmentsOfTopic(topic.id),
      staleTime: 30_000,
    })),
  });
  return results.flatMap((result) => (result.data ?? []).map(toTopicAssignmentRecord));
}

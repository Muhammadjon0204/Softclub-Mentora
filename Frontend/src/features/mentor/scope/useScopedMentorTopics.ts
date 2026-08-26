import { useQueries, useQuery } from '@tanstack/react-query';

import { listTopicAssignmentsOfTopic, listTopics } from '../../../api/lead/topics';
import type { LeadTopicAssignmentRecord, LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { toTopicAssignmentRecord, toTopicRecord } from '../../lead/schedule/topicAdapter';
import { useMentorScope } from './useMentorScope';

const MAX_PAGE_SIZE = 100;

export function mentorTopicsListQueryKey(organizationId: string, categoryId: string): readonly unknown[] {
  return ['mentor-topics', 'list', organizationId, categoryId] as const;
}

export function mentorTopicAssignmentsOfTopicQueryKey(topicId: string): readonly unknown[] {
  return ['mentor-topic-assignments-of-topic', topicId] as const;
}

/**
 * TP1: `GET /topics`, real replacement for the shared `useLeadTopicsPreview()` store filtered by
 * category. Mentor is read-only across this whole domain (`EnsureMayWriteSchedule` 403s any write
 * server-side even if one were reachable client-side) — this hook never exposes a mutation, only reads.
 */
export function useScopedMentorTopics(): LeadTopicRecord[] {
  const scope = useMentorScope();
  const listQuery = useQuery({
    queryKey: mentorTopicsListQueryKey(scope.organizationId, scope.categoryId),
    queryFn: () => listTopics({ pageSize: MAX_PAGE_SIZE }),
  });
  return (listQuery.data?.items ?? []).map(toTopicRecord);
}

export function useResolvedMentorTopic(topicId: string | null): LeadTopicRecord | undefined {
  const scoped = useScopedMentorTopics();
  if (topicId === null) return undefined;
  return scoped.find((topic) => topic.id === topicId);
}

/** TP8: `GET /topics/{topicId}/assignments`. */
export function useTopicAssignmentsOfMentor(topicId: string | null): LeadTopicAssignmentRecord[] {
  const listQuery = useQuery({
    queryKey: mentorTopicAssignmentsOfTopicQueryKey(topicId ?? 'none'),
    queryFn: () => listTopicAssignmentsOfTopic(topicId as string),
    enabled: topicId !== null,
  });
  return (listQuery.data ?? []).map(toTopicAssignmentRecord);
}

/** Same fan-out as `useScopedLeadSchedule.ts`'s `useAllTopicAssignments` — no "all templates of my category" endpoint exists, only per-topic. Used by `/mentor/schedule` for the "N заданий по теме" counter. */
export function useAllTopicAssignmentsForMentor(topics: LeadTopicRecord[]): LeadTopicAssignmentRecord[] {
  const results = useQueries({
    queries: topics.map((topic) => ({
      queryKey: mentorTopicAssignmentsOfTopicQueryKey(topic.id),
      queryFn: () => listTopicAssignmentsOfTopic(topic.id),
      staleTime: 30_000,
    })),
  });
  return results.flatMap((result) => (result.data ?? []).map(toTopicAssignmentRecord));
}

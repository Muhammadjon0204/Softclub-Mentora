import { useQueries, useQuery } from '@tanstack/react-query';

import { getAssignmentHistory, listAssignments } from '../../../api/lead/assignments';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { toAssignmentRecord, toTaskEventRecord } from '../../lead/assignments/assignmentAdapter';
import { useSubmissionSummaries, useSubmissionsDetailed } from '../../lead/assignments/useSubmissions';
import { useMentorScope } from './useMentorScope';

/** Same 100-cap precedent as `useScopedLeadAssignments.ts` — no pagination control exists in the Mentor UI either. */
const MAX_PAGE_SIZE = 100;

export function mentorAssignmentsListQueryKey(organizationId: string, mentorId: string): readonly unknown[] {
  return ['mentor-assignments', 'list', organizationId, mentorId] as const;
}

export function mentorAssignmentHistoryQueryKey(assignmentId: string): readonly unknown[] {
  return ['mentor-assignment-history', assignmentId] as const;
}

/**
 * LA1: `GET /assignments`, real replacement for `useLeadAssignmentsPreview()` filtered to
 * `mentorId === scope.mentorId && status !== Draft/Suggested`. The backend already applies exactly
 * that narrowing server-side for a Mentor caller (`AssignmentService.ApplyVisibility`), so this hook's
 * own scoping — implicit here, since the server never returns anything else — is defense-in-depth
 * rather than the sole guard, same principle the preview version documented.
 *
 * Mentor and Lead read the SAME real endpoint (`GET /assignments`) and the same adapter
 * (`assignmentAdapter.ts`) — not two parallel data models, exactly as the old preview stores were
 * built (`mentorAssignmentPreviewStore.ts` re-exporting from `leadAssignmentPreviewStore.ts`).
 */
export function useScopedMentorAssignments(): LeadAssignmentRecord[] {
  const scope = useMentorScope();

  const listQuery = useQuery({
    queryKey: mentorAssignmentsListQueryKey(scope.organizationId, scope.mentorId),
    queryFn: () => listAssignments({ pageSize: MAX_PAGE_SIZE }),
  });

  const base = (listQuery.data?.items ?? []).map(toAssignmentRecord);
  const submissionsById = useSubmissionSummaries(base.map((a) => a.id));

  return base.map((a) => ({ ...a, submissions: submissionsById.get(a.id) ?? a.submissions }));
}

/**
 * `EVT-004`: for a Mentor caller `TaskEventDto.actorId` is always `null` and `actorLabel` already
 * carries the masked role label (`"Lead"`/`"Система"`) — no resolution needed, unlike the Lead side
 * (`useScopedLeadAssignments.ts`'s `actorNameFor`), which has to resolve a raw id itself.
 */
const REVIEWER_LABEL = 'Руководитель направления';

/** LA2 (via list) + LA3 (history, already masked) + SB2/RV2 merged onto one record, mirroring `useResolvedLeadAssignment`. */
export function useResolvedMentorAssignment(assignmentId: string | null): LeadAssignmentRecord | undefined {
  const scoped = useScopedMentorAssignments();

  const historyQuery = useQuery({
    queryKey: mentorAssignmentHistoryQueryKey(assignmentId ?? 'none'),
    queryFn: () => getAssignmentHistory(assignmentId as string),
    enabled: assignmentId !== null,
  });

  const { submissions } = useSubmissionsDetailed(assignmentId, REVIEWER_LABEL);

  const base = assignmentId === null ? undefined : scoped.find((a) => a.id === assignmentId);
  if (base === undefined) return undefined;

  const events = (historyQuery.data ?? []).map((dto) => toTaskEventRecord(dto, dto.actorLabel ?? 'Система'));

  return { ...base, submissions, events };
}

/**
 * Every one of the Mentor's own assignments, with `events` hydrated (LA3 fanned out across all of
 * them) — used ONLY by `mentor-notifications` (`useMentorNotifications.ts`), which per Phase 0 §4.2
 * builds its feed by deriving from `TaskEvent`s across every assignment, not one at a time. Everywhere
 * else (Kanban, History list) reads `useScopedMentorAssignments()` without events — fetching full
 * history for every visible row would be wasteful when nothing else renders it.
 */
export function useScopedMentorAssignmentsWithEvents(): LeadAssignmentRecord[] {
  const base = useScopedMentorAssignments();

  const historyResults = useQueries({
    queries: base.map((a) => ({
      queryKey: mentorAssignmentHistoryQueryKey(a.id),
      queryFn: () => getAssignmentHistory(a.id),
      staleTime: 30_000,
    })),
  });

  return base.map((a, index) => ({
    ...a,
    events: (historyResults[index]?.data ?? []).map((dto) => toTaskEventRecord(dto, dto.actorLabel ?? 'Система')),
  }));
}

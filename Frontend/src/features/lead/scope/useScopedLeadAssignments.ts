import { useQuery } from '@tanstack/react-query';

import { getAssignmentHistory, listAssignments } from '../../../api/lead/assignments';
import type { TaskEventDto } from '../../../api/lead/assignments';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { toAssignmentRecord, toTaskEventRecord } from '../assignments/assignmentAdapter';
import { useSubmissionSummaries, useSubmissionsDetailed } from '../assignments/useSubmissions';
import type { LeadScope } from './useLeadScope';
import { useLeadScope } from './useLeadScope';
import { useLeadMentorNameResolver } from './useScopedLeadMentors';

/** Backend `PaginationLimits.MaxPageSize` (matches the same 100-cap precedent as `useUsersQuery.ts`/`useBranchesQuery.ts`) — no pagination control exists in the Lead UI, same documented limitation as those two. */
const MAX_PAGE_SIZE = 100;

export function leadAssignmentsListQueryKey(organizationId: string, categoryId: string): readonly unknown[] {
  return ['lead-assignments', 'list', organizationId, categoryId] as const;
}

export function assignmentHistoryQueryKey(assignmentId: string): readonly unknown[] {
  return ['lead-assignment-history', assignmentId] as const;
}

/**
 * LA1: `GET /assignments`, real replacement for `useLeadAssignmentsPreview()` + client-side category
 * filter. The backend already scopes a Lead caller to their own category server-side
 * (`AssignmentService.ApplyVisibility`), so no `categoryId` filter needs to travel in the request —
 * this hook's own scoping is now redundant with the server's but kept as defense-in-depth exactly the
 * way `leadScopedData.ts`'s doc comment always intended for the preview version.
 *
 * Every returned record carries Tier-1 submission data (`useSubmissions.ts`) — version number and
 * "sent late" flag for Kanban/table badges — but NOT review data or event history; those are Tier-2,
 * fetched only for the one assignment a drawer has open (`useResolvedLeadAssignment` below).
 */
export function useScopedLeadAssignments(): LeadAssignmentRecord[] {
  const scope = useLeadScope();

  const listQuery = useQuery({
    queryKey: leadAssignmentsListQueryKey(scope.organizationId, scope.categoryId),
    queryFn: () => listAssignments({ pageSize: MAX_PAGE_SIZE }),
  });

  const base = (listQuery.data?.items ?? []).map(toAssignmentRecord);
  const submissionsById = useSubmissionSummaries(base.map((a) => a.id));

  return base.map((a) => ({ ...a, submissions: submissionsById.get(a.id) ?? a.submissions }));
}

/**
 * `TaskEventDto.actorId` is raw and unmasked for a Lead/Admin caller (`EVT-004` only masks it for
 * Mentor). The only two kinds of actor possible inside a Lead's own category are the Lead themself and
 * one of their Mentors — both resolvable from data the Lead already legitimately has (`useLeadScope()`
 * for their own identity, `useScopedLeadMentors()` for the roster). A `null` actor is a
 * scheduler/system-triggered event (`MarkedOverdue`, `SuggestedCreated`).
 */
function actorNameFor(event: TaskEventDto, scope: LeadScope, resolveMentorName: (id: string) => string): string {
  if (event.actorId === null) return 'Система';
  if (event.actorId === scope.leadId) return scope.leadName;
  return resolveMentorName(event.actorId);
}

/**
 * LA2 (via the already-fetched list) + LA3 (history) + SB2/RV2 (submissions with review) merged onto
 * one record — real replacement for `.find(a => a.id === id)` over the old embedded-everything preview
 * record. `undefined` for a foreign/nonexistent id, same anti-enumeration behavior as before (LA1/LA2
 * both 404 for cross-category ids server-side; here it's simply absent from the scoped list).
 */
export function useResolvedLeadAssignment(assignmentId: string | null): LeadAssignmentRecord | undefined {
  const scope = useLeadScope();
  const scoped = useScopedLeadAssignments();
  const resolveMentorName = useLeadMentorNameResolver();

  const historyQuery = useQuery({
    queryKey: assignmentHistoryQueryKey(assignmentId ?? 'none'),
    queryFn: () => getAssignmentHistory(assignmentId as string),
    enabled: assignmentId !== null,
  });

  // A Lead reviewing their own category's work already knows the decision is theirs — no identity to
  // resolve (Phase 1E contract map, Open Question #3, option (b)).
  const { submissions } = useSubmissionsDetailed(assignmentId, scope.leadName);

  const base = assignmentId === null ? undefined : scoped.find((a) => a.id === assignmentId);
  if (base === undefined) return undefined;

  const events = (historyQuery.data ?? []).map((dto) => toTaskEventRecord(dto, actorNameFor(dto, scope, resolveMentorName)));

  return { ...base, submissions, events };
}

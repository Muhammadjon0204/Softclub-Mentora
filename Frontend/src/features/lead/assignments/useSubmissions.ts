import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { getReviewOrNull } from '../../../api/lead/reviews';
import { listSubmissions, querySubmissions, SUBMISSIONS_QUERY_MAX_IDS, type SubmissionDto } from '../../../api/lead/submissions';
import type { LeadSubmissionRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { toReviewRecord, toSubmissionRecord } from './assignmentAdapter';

/**
 * SB2/RV2 read-side plumbing shared by Lead (`useScopedLeadAssignments.ts`, `ReviewWorkspaceDrawer`
 * via `useResolvedLeadAssignment`) and Mentor (`useScopedMentorAssignments.ts`). Split into two tiers
 * on purpose — fetching full review data for every submission of every assignment in a list would be
 * wasteful when only the currently-open assignment's detail view actually renders it:
 *
 * - Tier 1 (`useSubmissionSummaries`): SB2 only, for every assignment in a scoped list — just enough
 *   to show the Kanban/table "vN" badge and the "sent late" flag.
 * - Tier 2 (`useSubmissionsDetailed`): SB2 + RV2 per submission, for exactly one (the open/selected)
 *   assignment — full data for `LeadAssignmentDetailsDrawer`/`ReviewWorkspaceDrawer`/
 *   `MentorAssignmentDetailsDrawer`.
 */

/** Root of every submissions query — single-assignment and batch alike. Invalidate this after a write. */
export const SUBMISSIONS_ROOT_KEY = ['lead-submissions'] as const;

export function submissionsQueryKey(assignmentId: string): readonly unknown[] {
  return ['lead-submissions', assignmentId] as const;
}

function submissionsBatchQueryKey(sortedAssignmentIds: string[]): readonly unknown[] {
  return ['lead-submissions', 'batch', ...sortedAssignmentIds] as const;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function reviewQueryKey(submissionId: string): readonly unknown[] {
  return ['lead-submission-review', submissionId] as const;
}

/** Newest-first (API order) -> oldest-first, matching every existing consumer's assumption that `submissions[length - 1]` is the latest version. */
function toAscending<T>(newestFirst: T[]): T[] {
  return [...newestFirst].reverse();
}

/**
 * Tier 1 — the submissions of every assignment in a scoped list, no review fetch. One
 * `POST /submissions/query` per 200 assignments — it used to be one `GET` per assignment, a request
 * per Kanban card at ~200 ms of network latency each. Safe to call with an empty array (no network
 * calls). Submissions carry no `review` at this tier (`null`) — callers needing reviews must be looking
 * at exactly one assignment and should use `useSubmissionsDetailed` instead.
 *
 * An assignment with no submissions gets an empty array once its batch has loaded, and no entry while
 * it is still loading — the same "absent until known" contract the per-assignment version had.
 */
export function useSubmissionSummaries(assignmentIds: string[]): Map<string, LeadSubmissionRecord[]> {
  // Sorted so the same set of assignments always maps to the same cache entry, whatever order the
  // list arrived in.
  const batches = chunk([...new Set(assignmentIds)].sort(), SUBMISSIONS_QUERY_MAX_IDS);

  const results = useQueries({
    queries: batches.map((ids) => ({
      queryKey: submissionsBatchQueryKey(ids),
      queryFn: () => querySubmissions(ids),
      staleTime: 30_000,
      // A refetch for a slightly different set (one card added) keeps the previous rows on screen
      // instead of blanking every version badge until it lands.
      placeholderData: keepPreviousData,
    })),
  });

  const map = new Map<string, LeadSubmissionRecord[]>();
  batches.forEach((ids, index) => {
    const data = results[index]?.data;
    if (data === undefined) return;

    const byAssignment = new Map<string, SubmissionDto[]>();
    for (const dto of data) {
      const list = byAssignment.get(dto.assignmentId);
      if (list === undefined) byAssignment.set(dto.assignmentId, [dto]);
      else list.push(dto);
    }

    for (const id of ids) {
      map.set(id, toAscending(byAssignment.get(id) ?? []).map((dto) => toSubmissionRecord(dto, null)));
    }
  });
  return map;
}

export interface DetailedSubmissions {
  submissions: LeadSubmissionRecord[];
  isLoading: boolean;
}

/**
 * Tier 2 — full submissions + per-submission review for exactly one assignment (`null` while nothing
 * is open, matching `useResolvedLeadAssignment`/`useResolvedMentorAssignment`'s own `assignmentId`
 * gating). `reviewerLabel` is stamped onto every review found — see `toReviewRecord()`'s doc comment
 * for why the raw `reviewerId` is never surfaced.
 */
export function useSubmissionsDetailed(assignmentId: string | null, reviewerLabel: string): DetailedSubmissions {
  const listQuery = useQuery({
    queryKey: submissionsQueryKey(assignmentId ?? 'none'),
    queryFn: () => listSubmissions(assignmentId as string),
    enabled: assignmentId !== null,
  });

  const submissionDtos = listQuery.data ?? [];

  const reviewResults = useQueries({
    queries: submissionDtos.map((submission) => ({
      queryKey: reviewQueryKey(submission.id),
      queryFn: () => getReviewOrNull(submission.id),
      enabled: assignmentId !== null,
      staleTime: 30_000,
    })),
  });

  const reviewById = new Map<string, ReturnType<typeof toReviewRecord> | null>();
  submissionDtos.forEach((submission, index) => {
    const reviewDto = reviewResults[index]?.data;
    reviewById.set(submission.id, reviewDto !== undefined && reviewDto !== null ? toReviewRecord(reviewDto, reviewerLabel) : null);
  });

  const submissions = toAscending(submissionDtos).map((dto) => toSubmissionRecord(dto, reviewById.get(dto.id) ?? null));
  const isLoading = assignmentId !== null && (listQuery.isPending || reviewResults.some((r) => r.isPending));

  return { submissions, isLoading };
}

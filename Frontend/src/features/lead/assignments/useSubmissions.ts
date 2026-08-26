import { useQueries, useQuery } from '@tanstack/react-query';

import { getReviewOrNull } from '../../../api/lead/reviews';
import { listSubmissions } from '../../../api/lead/submissions';
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

export function submissionsQueryKey(assignmentId: string): readonly unknown[] {
  return ['lead-submissions', assignmentId] as const;
}

export function reviewQueryKey(submissionId: string): readonly unknown[] {
  return ['lead-submission-review', submissionId] as const;
}

/** Newest-first (API order) -> oldest-first, matching every existing consumer's assumption that `submissions[length - 1]` is the latest version. */
function toAscending<T>(newestFirst: T[]): T[] {
  return [...newestFirst].reverse();
}

/**
 * Tier 1 — one lightweight `GET .../submissions` per assignment id, no review fetch. Safe to call with
 * an empty array (renders nothing, no network calls). Submissions carry no `review`/`comment` at this
 * tier (`null`) — callers needing those must be looking at exactly one assignment and should use
 * `useSubmissionsDetailed` instead.
 */
export function useSubmissionSummaries(assignmentIds: string[]): Map<string, LeadSubmissionRecord[]> {
  const results = useQueries({
    queries: assignmentIds.map((id) => ({
      queryKey: submissionsQueryKey(id),
      queryFn: () => listSubmissions(id),
      staleTime: 30_000,
    })),
  });

  const map = new Map<string, LeadSubmissionRecord[]>();
  assignmentIds.forEach((id, index) => {
    const data = results[index]?.data;
    if (data === undefined) return;
    map.set(id, toAscending(data).map((dto) => toSubmissionRecord(dto, null)));
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

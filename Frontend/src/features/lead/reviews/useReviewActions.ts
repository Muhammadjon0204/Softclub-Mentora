import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createReview } from '../../../api/lead/reviews';
import { getGenericErrorMessage } from '../../../api/problemDetails';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { toAssignmentRecord } from '../assignments/assignmentAdapter';
import { getAssignment } from '../../../api/lead/assignments';
import { assignmentHistoryQueryKey, leadAssignmentsListQueryKey } from '../scope/useScopedLeadAssignments';
import { useLeadScope } from '../scope/useLeadScope';
import { reviewQueryKey, submissionsQueryKey } from '../assignments/useSubmissions';

/**
 * RV1: `POST /submissions/{id}/reviews` — replaces `approvePreview`/`requestReworkPreview` from
 * `leadAssignmentPreviewStore.ts`. Two real gaps the old preview functions didn't have to deal with
 * (Phase 1E contract map, RV1 row):
 *
 * 1. The route's `{id}` is the LATEST SUBMISSION's id, not the assignment's — extracted here from the
 *    already-hydrated `assignment.submissions` (ascending order, so `[length - 1]` is the latest,
 *    matching every other read of "latest submission" in this codebase).
 * 2. The `concurrencyToken` sent is the ASSIGNMENT's — a submission carries none of its own.
 *
 * The response is a `ReviewDto`, not an `AssignmentDto` — the assignment's own new status/token are
 * fetched with a follow-up `GET /assignments/{id}` rather than assumed, since the review endpoint
 * doesn't hand them back directly.
 */

export class ReviewActionError extends Error {}

export interface UseReviewActionsResult {
  isSubmitting: boolean;
  approve: (assignment: LeadAssignmentRecord, comment: string | null) => Promise<LeadAssignmentRecord>;
  requestRework: (assignment: LeadAssignmentRecord, comment: string, reworkDueAtMs: number) => Promise<LeadAssignmentRecord>;
}

export function useReviewActions(): UseReviewActionsResult {
  const scope = useLeadScope();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateAfterDecision = useCallback(
    (assignment: LeadAssignmentRecord, submissionId: string): void => {
      void queryClient.invalidateQueries({ queryKey: leadAssignmentsListQueryKey(scope.organizationId, scope.categoryId) });
      void queryClient.invalidateQueries({ queryKey: assignmentHistoryQueryKey(assignment.id) });
      void queryClient.invalidateQueries({ queryKey: submissionsQueryKey(assignment.id) });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKey(submissionId) });
    },
    [queryClient, scope.organizationId, scope.categoryId],
  );

  const latestSubmissionId = useCallback((assignment: LeadAssignmentRecord): string => {
    const latest = assignment.submissions[assignment.submissions.length - 1];
    if (latest === undefined) {
      throw new ReviewActionError('У задания нет отправленного решения для проверки');
    }
    return latest.id;
  }, []);

  const decide = useCallback(
    async (assignment: LeadAssignmentRecord, decision: 'Approved' | 'NeedsRework', comment: string | null, reworkDueAtMs: number | null): Promise<LeadAssignmentRecord> => {
      setIsSubmitting(true);
      try {
        const submissionId = latestSubmissionId(assignment);
        const concurrencyToken = assignment.concurrencyToken;
        if (concurrencyToken === undefined) {
          throw new ReviewActionError('Не удалось определить версию задания для проверки — обновите страницу');
        }
        await createReview(submissionId, {
          decision,
          concurrencyToken,
          comment,
          reworkDueAt: reworkDueAtMs !== null ? new Date(reworkDueAtMs).toISOString() : null,
        });
        // CreateReviewRequest's response is the ReviewDto, not the updated assignment — the assignment's
        // new status/concurrencyToken come from a follow-up read.
        const updatedAssignment = await getAssignment(assignment.id);
        invalidateAfterDecision(assignment, submissionId);
        return toAssignmentRecord(updatedAssignment);
      } catch (error) {
        if (error instanceof ReviewActionError) throw error;
        throw new Error(getGenericErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [invalidateAfterDecision, latestSubmissionId],
  );

  const approve = useCallback(
    (assignment: LeadAssignmentRecord, comment: string | null): Promise<LeadAssignmentRecord> => decide(assignment, 'Approved', comment, null),
    [decide],
  );

  const requestRework = useCallback(
    (assignment: LeadAssignmentRecord, comment: string, reworkDueAtMs: number): Promise<LeadAssignmentRecord> => decide(assignment, 'NeedsRework', comment, reworkDueAtMs),
    [decide],
  );

  return { isSubmitting, approve, requestRework };
}

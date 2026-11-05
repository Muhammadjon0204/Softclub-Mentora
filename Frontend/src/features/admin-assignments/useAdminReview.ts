import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getAssignment } from '../../api/lead/assignments';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { toAssignmentRecord } from '../lead/assignments/assignmentAdapter';
import { useSubmissionsDetailed } from '../lead/assignments/useSubmissions';
import { useReviewDecision } from '../lead/reviews/useReviewActions';
import type { UseReviewActionsResult } from '../lead/reviews/useReviewActions';

/** В журнале решений администратор видит себя так же, как лид: решение принимал он сам. */
const REVIEWER_LABEL = 'Вы';

export interface AdminReview {
  assignment: LeadAssignmentRecord | undefined;
  decision: UseReviewActionsResult;
}

/**
 * Проверка работы администратором: тот же `ReviewWorkspaceDrawer`, что у лида, поверх той же записи.
 * Проверяет он только то, что выдал сам: остальное закрыто и на сервере.
 */
export function useAdminReview(assignmentId: string | null, listQueryKey: readonly unknown[]): AdminReview {
  const decision = useReviewDecision(listQueryKey);

  const query = useQuery({
    queryKey: ['admin-assignments', 'review', assignmentId],
    queryFn: () => getAssignment(assignmentId as string),
    enabled: assignmentId !== null,
  });

  const { submissions } = useSubmissionsDetailed(assignmentId, REVIEWER_LABEL);

  const assignment = useMemo(
    () => (query.data !== undefined ? { ...toAssignmentRecord(query.data), submissions } : undefined),
    [query.data, submissions],
  );

  return { assignment, decision };
}

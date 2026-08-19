import { useMemo } from 'react';

import { useLeadAssignmentsPreview } from '../../lead/assignments/leadAssignmentPreviewStore';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { useMentorScope } from './useMentorScope';

/**
 * Mentor и Lead читают ОДИН и тот же Assignment-стор (`leadAssignmentPreviewStore`)
 * — не два параллельных набора данных. Единственная разница — угол зрения:
 * Lead фильтрует по `categoryId` (`useScopedLeadAssignments`), Mentor — по
 * `mentorId` (собственные назначенные задачи, ТЗ 8.4: «видит только
 * собственные Assignment»). `Draft`/`Suggested` исключены всегда — по
 * разделу 13.2 они не опубликованы и не видны Mentor ни при каких условиях.
 */
export function useScopedMentorAssignments(): LeadAssignmentRecord[] {
  const scope = useMentorScope();
  const all = useLeadAssignmentsPreview();
  return useMemo(
    () => all.filter((a) => a.mentorId === scope.mentorId && a.status !== 'Draft' && a.status !== 'Suggested'),
    [all, scope.mentorId],
  );
}

/** Резолвит id только внутри собственного scope — чужой/несуществующий id даёт `undefined`, не 403 с раскрытием существования. */
export function useResolvedMentorAssignment(assignmentId: string | null): LeadAssignmentRecord | undefined {
  const scoped = useScopedMentorAssignments();
  if (assignmentId === null) return undefined;
  return scoped.find((a) => a.id === assignmentId);
}

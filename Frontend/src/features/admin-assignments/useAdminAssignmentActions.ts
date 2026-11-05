import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  cancelAssignment,
  createAssignmentDraft,
  publishAssignment,
  reassignAssignment,
  rescheduleAssignment,
  startAssignmentReview,
} from '../../api/lead/assignments';
import type { AssignmentDto } from '../../api/lead/assignments';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { patchAssignmentListCache } from '../lead/assignments/assignmentAdapter';

export interface NewAdminAssignment {
  assignedToId: string;
  title: string;
  description: string | null;
  dueAtMs: number;
}

export interface AdminAssignmentActions {
  assign: (input: NewAdminAssignment) => Promise<AssignmentDto>;
  reschedule: (assignment: AssignmentDto, dueAtMs: number, reason: string) => Promise<AssignmentDto>;
  reassign: (assignment: AssignmentDto, assigneeId: string) => Promise<AssignmentDto>;
  startReview: (assignment: AssignmentDto) => Promise<AssignmentDto>;
  cancel: (assignment: AssignmentDto, reason: string) => Promise<AssignmentDto>;
  isSubmitting: boolean;
}

/**
 * То же, что `useAssignmentActions` у лида, но для администратора: у него свой ключ списка, а филиал
 * задания известен из самого задания, поэтому «Все филиалы» отмене не мешают.
 */
export function useAdminAssignmentActions(listQueryKey: readonly unknown[]): AdminAssignmentActions {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (action: () => Promise<AssignmentDto>) =>
      action().catch((error: unknown) => { throw new Error(getGenericErrorMessage(error)); }),
    onSuccess: (updated) => {
      patchAssignmentListCache(queryClient, listQueryKey, updated);
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['admin-assignments', 'history', updated.id] });
    },
  });

  return {
    assign: (input) =>
      mutation.mutateAsync(async () => {
        const draft = await createAssignmentDraft({
          assignedToId: input.assignedToId,
          title: input.title,
          description: input.description,
          dueAt: new Date(input.dueAtMs).toISOString(),
        });

        return publishAssignment(draft.id, { concurrencyToken: draft.concurrencyToken });
      }),
    reschedule: (assignment, dueAtMs, reason) =>
      mutation.mutateAsync(() =>
        rescheduleAssignment(assignment.id, { dueAt: new Date(dueAtMs).toISOString(), reason, concurrencyToken: assignment.concurrencyToken })),
    reassign: (assignment, assigneeId) =>
      mutation.mutateAsync(() => reassignAssignment(assignment.id, { assignedToId: assigneeId, concurrencyToken: assignment.concurrencyToken })),
    startReview: (assignment) =>
      mutation.mutateAsync(() => startAssignmentReview(assignment.id, { concurrencyToken: assignment.concurrencyToken })),
    cancel: (assignment, reason) =>
      mutation.mutateAsync(() => cancelAssignment(assignment.id, { cancelReason: reason, concurrencyToken: assignment.concurrencyToken }, assignment.branchId)),
    isSubmitting: mutation.isPending,
  };
}

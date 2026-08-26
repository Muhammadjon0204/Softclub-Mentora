import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  acceptAssignmentSuggestion,
  cancelAssignment,
  createAssignmentDraft,
  publishAssignment,
  reassignAssignment,
  startAssignmentReview,
  updateAssignment as updateAssignmentApi,
} from '../../../api/lead/assignments';
import { getGenericErrorMessage } from '../../../api/problemDetails';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { assignmentHistoryQueryKey, leadAssignmentsListQueryKey } from '../scope/useScopedLeadAssignments';
import { useLeadScope } from '../scope/useLeadScope';
import { toAssignmentRecord } from './assignmentAdapter';

/**
 * LA4–LA10 real mutations — replaces `leadAssignmentPreviewStore.ts`'s create/edit/transition
 * functions. Mirrors `useBranchActions.ts`/`useCategoryActions.ts`'s split: this hook only makes the
 * network call, translates the error to a human-readable message (`getGenericErrorMessage`), and
 * invalidates the caches that need to refetch. Toast text and any navigation stay at the call site
 * (`AssignmentsPage.tsx`/`SuggestionsPage.tsx`/`ReviewQueuePage.tsx`) exactly as they already were —
 * those pages already had their own per-action `runAction()` + message, which this hook doesn't
 * duplicate.
 */

export interface CreateDraftInput {
  mentorId: string;
  topicAssignmentId: string | null;
  title: string;
  description: string;
  dueAtMs: number;
}

export interface EditAssignmentInput {
  mentorId: string;
  title: string;
  description: string;
  dueAtMs: number;
}

export interface UseAssignmentActionsResult {
  isSubmitting: boolean;
  createDraft: (input: CreateDraftInput) => Promise<LeadAssignmentRecord>;
  updateAssignment: (id: string, concurrencyToken: string, input: EditAssignmentInput) => Promise<LeadAssignmentRecord>;
  publish: (id: string, concurrencyToken: string) => Promise<LeadAssignmentRecord>;
  acceptSuggestion: (id: string, concurrencyToken: string) => Promise<LeadAssignmentRecord>;
  reassign: (id: string, concurrencyToken: string, mentorId: string) => Promise<LeadAssignmentRecord>;
  startReview: (id: string, concurrencyToken: string) => Promise<LeadAssignmentRecord>;
  /** LA10. Also used for "reject suggestion" — same endpoint, same cancel reason validation (ASN-012 is just a cancel of a Suggested-status assignment). */
  cancel: (id: string, concurrencyToken: string, reason: string) => Promise<LeadAssignmentRecord>;
}

export function useAssignmentActions(): UseAssignmentActionsResult {
  const scope = useLeadScope();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateList = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: leadAssignmentsListQueryKey(scope.organizationId, scope.categoryId) });
  }, [queryClient, scope.organizationId, scope.categoryId]);

  const invalidateOne = useCallback(
    (id: string): void => {
      invalidateList();
      void queryClient.invalidateQueries({ queryKey: assignmentHistoryQueryKey(id) });
    },
    [invalidateList, queryClient],
  );

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setIsSubmitting(true);
    try {
      return await action();
    } catch (error) {
      throw new Error(getGenericErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const createDraft = useCallback(
    async (input: CreateDraftInput): Promise<LeadAssignmentRecord> => {
      const created = await run(() =>
        createAssignmentDraft({
          assignedToId: input.mentorId,
          topicAssignmentId: input.topicAssignmentId,
          title: input.title,
          description: input.description.length > 0 ? input.description : null,
          dueAt: new Date(input.dueAtMs).toISOString(),
        }),
      );
      invalidateList();
      return toAssignmentRecord(created);
    },
    [run, invalidateList],
  );

  const updateAssignment = useCallback(
    async (id: string, concurrencyToken: string, input: EditAssignmentInput): Promise<LeadAssignmentRecord> => {
      // LA5 fix (Phase 1E contract map): the real `Assignment.Edit()` sets InitialDueAt/CurrentDueAt
      // unconditionally in both Draft and Suggested — `dueAt` is always sent here, never gated on the
      // assignment's current status the way the old preview function's bug did
      // (`initialDueAt: a.status === 'Draft' ? input.dueAt : a.initialDueAt`).
      const updated = await run(() =>
        updateAssignmentApi(id, {
          assignedToId: input.mentorId,
          title: input.title,
          description: input.description.length > 0 ? input.description : null,
          dueAt: new Date(input.dueAtMs).toISOString(),
          concurrencyToken,
        }),
      );
      invalidateOne(id);
      return toAssignmentRecord(updated);
    },
    [run, invalidateOne],
  );

  const publish = useCallback(
    async (id: string, concurrencyToken: string): Promise<LeadAssignmentRecord> => {
      const updated = await run(() => publishAssignment(id, { concurrencyToken }));
      invalidateOne(id);
      return toAssignmentRecord(updated);
    },
    [run, invalidateOne],
  );

  const acceptSuggestion = useCallback(
    async (id: string, concurrencyToken: string): Promise<LeadAssignmentRecord> => {
      const updated = await run(() => acceptAssignmentSuggestion(id, { concurrencyToken }));
      invalidateOne(id);
      return toAssignmentRecord(updated);
    },
    [run, invalidateOne],
  );

  const reassign = useCallback(
    async (id: string, concurrencyToken: string, mentorId: string): Promise<LeadAssignmentRecord> => {
      const updated = await run(() => reassignAssignment(id, { assignedToId: mentorId, concurrencyToken }));
      invalidateOne(id);
      return toAssignmentRecord(updated);
    },
    [run, invalidateOne],
  );

  const startReview = useCallback(
    async (id: string, concurrencyToken: string): Promise<LeadAssignmentRecord> => {
      const updated = await run(() => startAssignmentReview(id, { concurrencyToken }));
      invalidateOne(id);
      return toAssignmentRecord(updated);
    },
    [run, invalidateOne],
  );

  const cancel = useCallback(
    async (id: string, concurrencyToken: string, reason: string): Promise<LeadAssignmentRecord> => {
      const updated = await run(() => cancelAssignment(id, { cancelReason: reason, concurrencyToken }));
      invalidateOne(id);
      return toAssignmentRecord(updated);
    },
    [run, invalidateOne],
  );

  return { isSubmitting, createDraft, updateAssignment, publish, acceptSuggestion, reassign, startReview, cancel };
}

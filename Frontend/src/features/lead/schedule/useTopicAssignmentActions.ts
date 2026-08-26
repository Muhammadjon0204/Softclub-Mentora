import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createTopicAssignment as createTopicAssignmentApi } from '../../../api/lead/topics';
import {
  activateTopicAssignment as activateTopicAssignmentApi,
  deactivateTopicAssignment as deactivateTopicAssignmentApi,
  updateTopicAssignment as updateTopicAssignmentApi,
} from '../../../api/lead/topicAssignments';
import { getGenericErrorMessage } from '../../../api/problemDetails';
import type { LeadTopicAssignmentRecord, TopicAssignmentType } from '../../../mocks/ui-preview/leadTopics.preview';
import { topicAssignmentsOfTopicQueryKey } from '../scope/useScopedLeadSchedule';
import { toTopicAssignmentRecord } from './topicAdapter';

/** TP9/TA2–TA4 real mutations — replaces `createTopicAssignmentPreview`/`updateTopicAssignmentPreview`/`setTopicAssignmentActivePreview` from `leadSchedulePreviewStore.ts`. */

export interface UpsertTopicAssignmentInput {
  type: TopicAssignmentType;
  title: string;
  description: string;
  isRequired: boolean;
}

export interface UseTopicAssignmentActionsResult {
  isSubmitting: boolean;
  createTopicAssignment: (topicId: string, input: UpsertTopicAssignmentInput) => Promise<LeadTopicAssignmentRecord>;
  updateTopicAssignment: (topicId: string, id: string, concurrencyToken: string, input: UpsertTopicAssignmentInput) => Promise<LeadTopicAssignmentRecord>;
  setActive: (topicId: string, id: string, concurrencyToken: string, isActive: boolean) => Promise<LeadTopicAssignmentRecord>;
}

export function useTopicAssignmentActions(): UseTopicAssignmentActionsResult {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidate = useCallback(
    (topicId: string): void => {
      void queryClient.invalidateQueries({ queryKey: topicAssignmentsOfTopicQueryKey(topicId) });
    },
    [queryClient],
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

  const createTopicAssignment = useCallback(
    async (topicId: string, input: UpsertTopicAssignmentInput): Promise<LeadTopicAssignmentRecord> => {
      const created = await run(() =>
        createTopicAssignmentApi(topicId, {
          type: input.type,
          title: input.title,
          description: input.description.length > 0 ? input.description : null,
          isRequired: input.isRequired,
        }),
      );
      invalidate(topicId);
      return toTopicAssignmentRecord(created);
    },
    [run, invalidate],
  );

  const updateTopicAssignment = useCallback(
    async (topicId: string, id: string, concurrencyToken: string, input: UpsertTopicAssignmentInput): Promise<LeadTopicAssignmentRecord> => {
      const updated = await run(() =>
        updateTopicAssignmentApi(id, {
          type: input.type,
          title: input.title,
          description: input.description.length > 0 ? input.description : null,
          isRequired: input.isRequired,
          concurrencyToken,
        }),
      );
      invalidate(topicId);
      return toTopicAssignmentRecord(updated);
    },
    [run, invalidate],
  );

  /** TA3/TA4 — the old preview conflated both behind one boolean-flag function; split into the two real endpoints here, same call shape kept for the caller (`TopicDetailsDrawer.tsx`'s Archive/Restore button already just flips a boolean). */
  const setActive = useCallback(
    async (topicId: string, id: string, concurrencyToken: string, isActive: boolean): Promise<LeadTopicAssignmentRecord> => {
      const updated = await run(() =>
        isActive ? activateTopicAssignmentApi(id, { concurrencyToken }) : deactivateTopicAssignmentApi(id, { concurrencyToken }),
      );
      invalidate(topicId);
      return toTopicAssignmentRecord(updated);
    },
    [run, invalidate],
  );

  return { isSubmitting, createTopicAssignment, updateTopicAssignment, setActive };
}

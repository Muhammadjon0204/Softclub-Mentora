import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  activateTopic as activateTopicApi,
  createTopic as createTopicApi,
  deactivateTopic as deactivateTopicApi,
  updateTopic as updateTopicApi,
} from '../../../api/lead/topics';
import { getGenericErrorMessage } from '../../../api/problemDetails';
import type { LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { leadTopicsListQueryKey } from '../scope/useScopedLeadSchedule';
import { useLeadScope } from '../scope/useLeadScope';
import { msToDateOnly, toTopicRecord } from './topicAdapter';

/**
 * TP3–TP6 real mutations — replaces `createTopicPreview`/`updateTopicPreview`/`setTopicActivePreview`
 * from `leadSchedulePreviewStore.ts`.
 *
 * TP3/TP4 fix (Phase 1E contract map — "not ambiguous, just needs fixing"): the old preview store's
 * doc comment claimed `PlannedDate` uniqueness was "a warning, not a hard block". That was wrong — the
 * backend enforces TWO separate hard unique constraints per category (`ux_topics_category_planned_date`
 * on `plannedDate`, `ux_topics_category_day` on `dayNumber`), both a real blocking 409
 * `RESOURCE_ALREADY_EXISTS`. Nothing special-cases that code here: it's just not swallowed — `run()`
 * below turns it into a message via `getGenericErrorMessage` (which already surfaces `problem.detail`,
 * the backend's specific Russian message for each of the two constraints) and the caller
 * (`TopicFormDrawer.tsx`) shows it as a blocking banner error, not a dismissible warning toast.
 */

export interface CreateTopicInput {
  dayNumber: number;
  plannedDate: number | null;
  title: string;
  description: string;
}

export interface UpdateTopicInput {
  dayNumber: number;
  plannedDate: number | null;
  title: string;
  description: string;
}

export interface UseTopicActionsResult {
  isSubmitting: boolean;
  createTopic: (input: CreateTopicInput) => Promise<LeadTopicRecord>;
  updateTopic: (id: string, concurrencyToken: string, input: UpdateTopicInput) => Promise<LeadTopicRecord>;
  /** TP5 — no UI trigger exists for this in either the old preview or the real pass (pre-existing gap; only the TopicAssignment-level toggle has a button). See `docs/INTEGRATION_UI_ISSUES.md`. */
  activateTopic: (id: string, concurrencyToken: string) => Promise<LeadTopicRecord>;
  /** TP6 — same gap as `activateTopic`. */
  deactivateTopic: (id: string, concurrencyToken: string) => Promise<LeadTopicRecord>;
}

export function useTopicActions(): UseTopicActionsResult {
  const scope = useLeadScope();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateList = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: leadTopicsListQueryKey(scope.organizationId, scope.categoryId) });
  }, [queryClient, scope.organizationId, scope.categoryId]);

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

  const createTopic = useCallback(
    async (input: CreateTopicInput): Promise<LeadTopicRecord> => {
      const created = await run(() =>
        createTopicApi({
          categoryId: scope.categoryId,
          dayNumber: input.dayNumber,
          plannedDate: msToDateOnly(input.plannedDate),
          title: input.title,
          description: input.description.length > 0 ? input.description : null,
        }),
      );
      invalidateList();
      return toTopicRecord(created);
    },
    [run, invalidateList, scope.categoryId],
  );

  const updateTopic = useCallback(
    async (id: string, concurrencyToken: string, input: UpdateTopicInput): Promise<LeadTopicRecord> => {
      const updated = await run(() =>
        updateTopicApi(id, {
          dayNumber: input.dayNumber,
          plannedDate: msToDateOnly(input.plannedDate),
          title: input.title,
          description: input.description.length > 0 ? input.description : null,
          concurrencyToken,
        }),
      );
      invalidateList();
      return toTopicRecord(updated);
    },
    [run, invalidateList],
  );

  const activateTopic = useCallback(
    async (id: string, concurrencyToken: string): Promise<LeadTopicRecord> => {
      const updated = await run(() => activateTopicApi(id, { concurrencyToken }));
      invalidateList();
      return toTopicRecord(updated);
    },
    [run, invalidateList],
  );

  const deactivateTopic = useCallback(
    async (id: string, concurrencyToken: string): Promise<LeadTopicRecord> => {
      const updated = await run(() => deactivateTopicApi(id, { concurrencyToken }));
      invalidateList();
      return toTopicRecord(updated);
    },
    [run, invalidateList],
  );

  return { isSubmitting, createTopic, updateTopic, activateTopic, deactivateTopic };
}

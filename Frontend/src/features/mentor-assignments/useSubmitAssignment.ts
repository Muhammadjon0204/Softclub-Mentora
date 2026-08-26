import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { uploadSubmission } from '../../api/lead/submissions';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { submissionsQueryKey } from '../lead/assignments/useSubmissions';
import { mentorAssignmentHistoryQueryKey, mentorAssignmentsListQueryKey } from '../mentor/scope/useScopedMentorAssignments';
import { useMentorScope } from '../mentor/scope/useMentorScope';
import type { PendingFile } from '../../shared/ui/FileDropzone';

/**
 * SB1 (`POST /assignments/{id}/submissions`) — the real upload networking `MentorAssignmentDetailsDrawer`'s
 * `SubmissionForm` was left calling the old in-memory `submitPreview()` for (issue #15,
 * `docs/INTEGRATION_UI_ISSUES.md`). Mirrors `useAssignmentActions.ts`/`useCategoryActions.ts`'s split:
 * this hook only makes the network call(s), translates errors via `getGenericErrorMessage`, and
 * invalidates the caches the drawer already reads from — toast text and `pending`-list bookkeeping stay
 * at the call site (`SubmissionForm.handleSubmit`), same division of responsibility as those two hooks.
 *
 * Multi-file → sequential per-file versions (Phase 1E contract map, Open Question #2 — resolved): the
 * real backend has no concept of "attach N files to one submission" — every `POST` is exactly one file
 * and exactly one new `VersionNumber`, and the second file's version is built on top of whatever the
 * first file's call just created, so they cannot be sent concurrently. `submitFiles` below awaits each
 * `uploadSubmission` call before starting the next, and does NOT stop at the first failure — a file
 * that fails (wrong type, duplicate content, etc.) doesn't block a later file in the same batch from
 * still becoming the next version. Every attempt's outcome is reported back, not just the first
 * failure, so the caller can build an honest "N of M sent, file K failed: <reason>" message instead of
 * a single generic error — same "don't hide a partial real success" principle
 * `useCategoryActions.ts`'s `changeLead`/`createCategory` already established for cross-domain
 * orchestration.
 */

export interface SubmitFileResult {
  file: PendingFile;
  outcome: 'success' | 'error';
  message?: string;
}

export interface UseSubmitAssignmentResult {
  isSubmitting: boolean;
  /**
   * Uploads every file in `files`, sequentially, updating each one's `status`/`progress`/`errorMessage`
   * in place via `onFileUpdate` (the caller owns the actual `PendingFile[]` state — same "hook drives,
   * component owns state" split `FileDropzone`'s own `files`/`onFilesChange` props already use).
   * Invalidates the assignment list/history/submissions caches once, after the whole batch finishes, if
   * at least one file succeeded (a real status transition to `Submitted` happened server-side).
   */
  submitFiles: (
    assignmentId: string,
    files: PendingFile[],
    onFileUpdate: (id: string, patch: Partial<Pick<PendingFile, 'status' | 'progress' | 'errorMessage'>>) => void,
  ) => Promise<SubmitFileResult[]>;
}

export function useSubmitAssignment(): UseSubmitAssignmentResult {
  const scope = useMentorScope();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidate = useCallback(
    (assignmentId: string): void => {
      void queryClient.invalidateQueries({ queryKey: mentorAssignmentsListQueryKey(scope.organizationId, scope.mentorId) });
      void queryClient.invalidateQueries({ queryKey: mentorAssignmentHistoryQueryKey(assignmentId) });
      void queryClient.invalidateQueries({ queryKey: submissionsQueryKey(assignmentId) });
    },
    [queryClient, scope.organizationId, scope.mentorId],
  );

  const submitFiles = useCallback(
    async (
      assignmentId: string,
      files: PendingFile[],
      onFileUpdate: (id: string, patch: Partial<Pick<PendingFile, 'status' | 'progress' | 'errorMessage'>>) => void,
    ): Promise<SubmitFileResult[]> => {
      setIsSubmitting(true);
      const results: SubmitFileResult[] = [];
      let anySucceeded = false;

      try {
        for (const pending of files) {
          onFileUpdate(pending.id, { status: 'uploading', progress: 0, errorMessage: undefined });
          try {
            // Intentionally sequential (not `Promise.all`): the backend builds each new version on top
            // of the previous one, so concurrent POSTs for the same assignment would race.
            await uploadSubmission(assignmentId, pending.file, (percent) => {
              onFileUpdate(pending.id, { progress: percent });
            });
            onFileUpdate(pending.id, { status: 'ready', progress: 100 });
            results.push({ file: pending, outcome: 'success' });
            anySucceeded = true;
          } catch (error) {
            const message = getGenericErrorMessage(error);
            onFileUpdate(pending.id, { status: 'error', errorMessage: message });
            results.push({ file: pending, outcome: 'error', message });
          }
        }
      } finally {
        setIsSubmitting(false);
        if (anySucceeded) invalidate(assignmentId);
      }

      return results;
    },
    [invalidate],
  );

  return { isSubmitting, submitFiles };
}

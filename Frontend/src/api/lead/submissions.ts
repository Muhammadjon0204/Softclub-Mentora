import { apiClient } from '../client';

/**
 * `Backend/src/MentorTaskFlow.Contracts/Submissions/SubmissionDtos.cs`. SB1–SB4: `uploadSubmission`
 * (SB1, the real file upload) plus the SB2–SB4 reads (`listSubmissions`/`getSubmissionDownloadUrl`/
 * `getSubmissionPreviewUrl`), all wired to real UI trigger points (`FileDropzone.tsx` via
 * `useSubmitAssignment.ts`, `FileDetailsModal`/`FilePreviewModal`).
 *
 * One file per submission version — there is no `files: SubmissionFile[]` array on the real contract
 * the way the old preview fixtures modeled it (Phase 1E contract map, Open Question #2 — resolved:
 * multiple files in the old UI model become multiple sequential submission versions in the real one,
 * see `useSubmitAssignment.ts`).
 */
/**
 * The five file fields are `null` together on a comment-only submission (2026-09-28) — not every task
 * produces a file to attach (e.g. "call the parents"). `comment` is the only content in that case, and
 * optional context alongside a file otherwise.
 */
export interface SubmissionDto {
  id: string;
  assignmentId: string;
  versionNumber: number;
  originalFileName: string | null;
  contentType: string | null;
  fileExtension: string | null;
  fileSizeBytes: number | null;
  sha256Hash: string | null;
  comment: string | null;
  isLate: boolean;
  submittedById: string;
  submittedAt: string;
  hasPreview: boolean;
}

/** SB3/SB4 response — a presigned URL and when it stops working. Never cached (`Cache-Control: no-store` on the response). */
export interface FileUrlDto {
  url: string;
  expiresAt: string;
}

/** SB2: `GET /assignments/{id}/submissions` — newest-first. */
export async function listSubmissions(assignmentId: string): Promise<SubmissionDto[]> {
  const { data } = await apiClient.get<SubmissionDto[]>(`/api/v1/assignments/${assignmentId}/submissions`);
  return data;
}

/** SB3: `GET /submissions/{id}/download-url` — presigned, ~10 minute TTL (`PresignedUrlMinutes`, configurable 1–60). */
export async function getSubmissionDownloadUrl(submissionId: string): Promise<FileUrlDto> {
  const { data } = await apiClient.get<FileUrlDto>(`/api/v1/submissions/${submissionId}/download-url`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return data;
}

/** SB4: `GET /submissions/{id}/preview-url` — PDF only; a PPTX submission answers a real 404 (no preview in Release 1.0, `17.5`), not an error state to design around. */
export async function getSubmissionPreviewUrl(submissionId: string): Promise<FileUrlDto> {
  const { data } = await apiClient.get<FileUrlDto>(`/api/v1/submissions/${submissionId}/preview-url`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return data;
}

/**
 * SB1: `POST /assignments/{id}/submissions`, `multipart/form-data`, `Mentor` policy. Real file upload —
 * the SB1 follow-up this module's original doc comment deferred (`FileDropzone.tsx`/
 * `MentorAssignmentDetailsDrawer.tsx`'s `SubmissionForm` now call this via
 * `features/mentor-assignments/useSubmitAssignment.ts`).
 *
 * `file` is optional (2026-09-28): not every task produces a file to hand in (e.g. "call the parents"),
 * so a mentor may submit a comment alone — the caller must supply at least one of `file`/`comment`, the
 * server rejects both empty with 422. Still never `organizationId`/`branchId`/`categoryId`/`assignmentId`
 * (hard 400 `VALIDATION_FAILED`, `TEN-061`).
 *
 * `apiClient`'s instance default is `Content-Type: application/json` (`api/client.ts`) — axios's
 * `transformRequest` only leaves a `FormData` body untouched when the header at request-build time is
 * NOT `application/json` (otherwise it JSON-stringifies the FormData object, which would corrupt the
 * upload). The explicit `multipart/form-data` header below exists only to defeat that instance default;
 * axios's browser adapter (`resolveConfig.js`) unconditionally strips it back out right before sending
 * so the browser can set the real header with its multipart boundary.
 */
export async function uploadSubmission(
  assignmentId: string,
  file: File | null,
  comment: string | null,
  onProgress?: (percent: number) => void,
): Promise<SubmissionDto> {
  const formData = new FormData();
  if (file !== null) formData.append('file', file);
  if (comment !== null && comment.trim().length > 0) formData.append('comment', comment.trim());

  const { data } = await apiClient.post<SubmissionDto>(`/api/v1/assignments/${assignmentId}/submissions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress === undefined) return;
      // Capped at 99 while bytes are still in flight — 100 is reserved for the moment the server
      // actually confirms success (hashing/validation happens after the last byte lands), so the bar
      // never sits at "100%" while the request could still fail.
      const percent = event.total !== undefined && event.total > 0 ? Math.min(99, Math.round((event.loaded / event.total) * 100)) : 0;
      onProgress(percent);
    },
  });
  return data;
}

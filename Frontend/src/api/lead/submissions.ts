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
export interface SubmissionDto {
  id: string;
  assignmentId: string;
  versionNumber: number;
  originalFileName: string;
  contentType: string;
  fileExtension: string;
  fileSizeBytes: number;
  sha256Hash: string;
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
 * Exactly one multipart field (`file`) — never `organizationId`/`branchId`/`categoryId`/`assignmentId`
 * (hard 400 `VALIDATION_FAILED`, `TEN-061`) and never a `comment` field (Phase 1E contract map, Open
 * Question #1 — resolved: the real contract has nowhere for it to land, so it's dropped here rather
 * than silently ignored server-side).
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
  file: File,
  onProgress?: (percent: number) => void,
): Promise<SubmissionDto> {
  const formData = new FormData();
  formData.append('file', file);

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

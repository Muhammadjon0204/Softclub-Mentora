import axios from 'axios';

import { apiClient } from '../client';

/**
 * `Backend/src/MentorTaskFlow.Contracts/Reviews/ReviewDtos.cs`. RV1–RV2. A `Review` is immutable once
 * written (`REV-020`) — no `PUT`/`DELETE` exists for anyone, not even an Admin.
 *
 * `reviewerId` is a raw, unmasked Guid on the wire, but per the Phase 1E contract map's Open Question
 * #3 (resolved, not re-litigated here): a Mentor cannot resolve it to a name (`GET /users` is
 * Lead/Admin-only) and a Lead already knows a review shown here is their own decision. Callers of this
 * client must NOT surface `reviewerId` as an identity anywhere — the consuming hooks
 * (`useAssignmentActions.ts`/`useScopedLeadAssignments.ts`/`useScopedMentorAssignments.ts`) replace it
 * with a role-appropriate label instead of ever rendering the raw id.
 */
export interface ReviewDto {
  id: string;
  submissionId: string;
  assignmentId: string;
  reviewerId: string;
  decision: string;
  comment: string | null;
  reworkDueAt: string | null;
  createdAt: string;
}

/**
 * RV1: `POST /submissions/{id}/reviews`. `id` in the route is the LATEST submission's id (not the
 * assignment's) — callers must resolve it from the newest-first `SubmissionDto[]` (SB2) before calling
 * this. `concurrencyToken` is the ASSIGNMENT's token — a submission carries none of its own.
 */
export interface CreateReviewRequest {
  decision: 'Approved' | 'NeedsRework';
  concurrencyToken: string;
  comment?: string | null;
  reworkDueAt?: string | null;
}

/** RV1: 201, the new `ReviewDto`. */
export async function createReview(submissionId: string, request: CreateReviewRequest): Promise<ReviewDto> {
  const { data } = await apiClient.post<ReviewDto>(`/api/v1/submissions/${submissionId}/reviews`, request);
  return data;
}

/**
 * RV2: `GET /submissions/{id}/review` — 404 while the submission has no decision yet. Callers should
 * treat a 404 here as "no review", not as an error to surface — see `getReviewOrNull` below, which is
 * what every consuming hook should call instead of this directly.
 */
export async function getReview(submissionId: string): Promise<ReviewDto> {
  const { data } = await apiClient.get<ReviewDto>(`/api/v1/submissions/${submissionId}/review`);
  return data;
}

/** RV2, 404-tolerant: returns `null` instead of throwing when the submission has no decision yet (the expected, common case — not an error state). */
export async function getReviewOrNull(submissionId: string): Promise<ReviewDto | null> {
  try {
    return await getReview(submissionId);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

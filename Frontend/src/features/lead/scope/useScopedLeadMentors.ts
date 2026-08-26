import { useMemo } from 'react';

import { useUsersQuery } from '../../admin-users/useUsersQuery';
import type { MentorDirectoryEntry, MentorStatus } from './leadWorkspace';
import { useLeadScope } from './useLeadScope';

/**
 * Real replacement for the old fixture-backed hook (`leadMentorPreviewStore.ts`'s
 * `useLeadMentorsPreview`, still used as-is by `leadScopedData.ts`'s plain `scopedMentors()` family —
 * those are out of this pass's scope, see the integration report for the resulting Dashboard/Reports
 * mismatch this leaves behind, logged in `docs/INTEGRATION_UI_ISSUES.md`).
 *
 * `GET /users` (`useUsersQuery`, already wired by the prior Users integration pass) scopes a Lead
 * caller server-side to exactly their own category (`UserService.ApplyVisibility`:
 * `{ Role: Lead } => source.Where(u => u.CategoryId == actor.CategoryId)`) — filtering to
 * `role === 'Mentor'` here only drops the Lead's own row from that same response. Reused rather than
 * rebuilt: Users domain is out of scope to touch, but it's already real and already gives a Lead
 * exactly this roster.
 */
export interface RealLeadMentor extends MentorDirectoryEntry {
  /** Real `UserDto.lastLoginAt`, already formatted by `useUsersQuery.ts` — the real replacement for `lastActiveOffsetHours` (always `null` here, see below). */
  lastLoginLabel: string;
}

function toMentorStatus(status: 'Active' | 'Invited' | 'Locked' | 'Deactivated'): MentorStatus {
  // Real backend has no "Locked" concept (docs/phase-1-owner-organization-admin §3.3, Block/Unblock —
  // Product Decision Required). A deactivated account is the closest real equivalent for this
  // display-only status badge.
  return status === 'Deactivated' ? 'Locked' : status;
}

export function useScopedLeadMentors(): RealLeadMentor[] {
  const scope = useLeadScope();
  const { users } = useUsersQuery();

  return useMemo(
    () =>
      users
        .filter((user) => user.role === 'Mentor' && user.categoryId === scope.categoryId)
        .map((user): RealLeadMentor => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          categoryId: user.categoryId ?? scope.categoryId,
          branchId: scope.branchId,
          status: toMentorStatus(user.status),
          // Real UserDto has no "hours since last activity", only an absolute `lastLoginAt` — already
          // formatted as `lastLoginLabel` below. `null` here rather than a fabricated offset.
          lastActiveOffsetHours: null,
          createdOffsetDays: 0,
          lastLoginLabel: user.lastLoginLabel,
        })),
    [users, scope.categoryId, scope.branchId],
  );
}

/** Same filtering semantics as the old `scopedActiveMentors()` — excludes `Invited` (no password set yet, not a legitimate assignment target). */
export function useActiveLeadMentors(): RealLeadMentor[] {
  return useScopedLeadMentors().filter((mentor) => mentor.status !== 'Invited');
}

/** id -> display name, `'Ментор'` fallback for a stale/foreign id — the real, hook-based replacement for `mentorNameOf()` from `leadScopedData.ts` (kept as a plain function there only for the out-of-scope Dashboard/Reports consumers). */
export function useLeadMentorNameResolver(): (mentorId: string) => string {
  const mentors = useScopedLeadMentors();
  const map = useMemo(() => new Map(mentors.map((mentor) => [mentor.id, mentor.fullName])), [mentors]);
  return (mentorId: string): string => map.get(mentorId) ?? 'Ментор';
}

export function useResolvedLeadMentor(mentorId: string | null): RealLeadMentor | undefined {
  const scoped = useScopedLeadMentors();
  if (mentorId === null) return undefined;
  return scoped.find((mentor) => mentor.id === mentorId);
}

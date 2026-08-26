import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createUser } from '../../../api/admin/users';
import { getGenericErrorMessage } from '../../../api/problemDetails';
import { useAuth } from '../../../auth/useAuth';
import { usersListQueryKey } from '../../admin-users/useUsersQuery';
import { useLeadScope } from '../scope/useLeadScope';

/**
 * `leadMentorPreviewStore.ts`'s Team page (`CreateMentorDrawer.tsx`) is Users-domain-adjacent: "Lead
 * adds a Mentor" is really `POST /users` with `role="Mentor"` — a real, already-wired Users endpoint
 * (`api/admin/users.ts`'s `createUser`, built by the prior Users integration pass), not a Lead/Mentor
 * endpoint of its own. Reused here exactly as `useCategoryActions.ts` already reuses `changeUserRole`/
 * `deactivateUser` from the same file for its own cross-domain orchestration — this does not modify
 * `api/admin/users.ts`, only calls what it already exports.
 *
 * Wiring this (rather than leaving `CreateMentorDrawer.tsx` on the old preview store) is what keeps
 * Team's mentor ids consistent with the real `AssignedToId` guids `useScopedLeadAssignments.ts`/
 * `useScopedLeadMentors.ts` now read — otherwise a Lead could never actually pick a real Mentor to
 * assign a Draft to (see the integration report for the identity-consistency reasoning).
 */
export interface CreateMentorInput {
  fullName: string;
  email: string;
}

export interface UseTeamActionsResult {
  isSubmitting: boolean;
  createMentor: (input: CreateMentorInput) => Promise<void>;
}

export function useTeamActions(): UseTeamActionsResult {
  const { user } = useAuth();
  const scope = useLeadScope();
  const organizationId = user?.organization.id ?? 'anonymous';
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMentor = useCallback(
    async (input: CreateMentorInput): Promise<void> => {
      setIsSubmitting(true);
      try {
        // Role/categoryId are also enforced server-side from the Lead's own claims — this call can
        // only ever create a Mentor of the Lead's own category, matching what the form already told
        // the Lead would happen ("Роль (Ментор), филиал и направление определяются автоматически").
        await createUser({ fullName: input.fullName, email: input.email, role: 'Mentor', categoryId: scope.categoryId });
        void queryClient.invalidateQueries({ queryKey: usersListQueryKey(organizationId) });
      } catch (error) {
        throw new Error(getGenericErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient, organizationId, scope.categoryId],
  );

  return { isSubmitting, createMentor };
}

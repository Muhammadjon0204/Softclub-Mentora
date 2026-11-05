import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserPermissions, setUserPermission } from '../../api/admin/permissions';
import type { UserPermissions } from '../../api/admin/permissions';
import { getGenericErrorMessage } from '../../api/problemDetails';

export const PERMISSIONS_KEY = ['admin-permissions'] as const;

export function useUserPermissions(userId: string | null): {
  data: UserPermissions | undefined;
  isPending: boolean;
  error: Error | null;
  refetch: () => void;
  set: (permission: string, allowed: boolean | null) => Promise<void>;
} {
  const queryClient = useQueryClient();
  const queryKey = [...PERMISSIONS_KEY, 'user', userId];

  const query = useQuery({
    queryKey,
    queryFn: () => getUserPermissions(userId as string),
    enabled: userId !== null,
  });

  const mutation = useMutation({
    mutationFn: ({ permission, allowed }: { permission: string; allowed: boolean | null }) =>
      setUserPermission(userId as string, permission, allowed)
        .catch((error: unknown) => { throw new Error(getGenericErrorMessage(error)); }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      void queryClient.invalidateQueries({ queryKey: [...PERMISSIONS_KEY, 'exceptions'] });
    },
  });

  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    refetch: () => { void query.refetch(); },
    set: async (permission, allowed) => { await mutation.mutateAsync({ permission, allowed }); },
  };
}

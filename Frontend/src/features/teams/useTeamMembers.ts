import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getGenericErrorMessage } from '../../api/problemDetails';
import { addTeamMember, changeTeamMemberRole, listTeamMembers, removeTeamMember } from '../../api/teams';
import { usePermissions, PERMISSION } from '../../auth/usePermissions';
import { useToast } from '../../shared/overlays';

export const teamMembersQueryKey = (categoryId: string) => ['team-members', categoryId] as const;

/** Состав одной команды и действия над ним. После любого действия перечитывается всё, где видны люди. */
export function useTeamMembers(categoryId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = usePermissions();

  const query = useQuery({
    queryKey: teamMembersQueryKey(categoryId),
    queryFn: () => listTeamMembers(categoryId),
  });

  /** Команды человека видны в списках пользователей и в выборе исполнителя — обновляем и их. */
  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries();
  };

  const add = useMutation({
    mutationFn: (input: { userId: string; role: string }) => addTeamMember(categoryId, input.userId, input.role),
    onSuccess: async (member) => {
      toast.success(`${member.fullName} теперь в команде.`);
      await refresh();
    },
  });

  const changeRole = useMutation({
    mutationFn: (input: { userId: string; role: string }) => changeTeamMemberRole(categoryId, input.userId, input.role),
    onSuccess: async () => {
      toast.success('Роль в команде изменена.');
      await refresh();
    },
    onError: (error) => { toast.error(getGenericErrorMessage(error)); },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeTeamMember(categoryId, userId),
    onSuccess: async () => {
      toast.success('Участник убран из команды.');
      await refresh();
    },
  });

  return { query, add, changeRole, remove, canManage: can(PERMISSION.usersManage) };
}

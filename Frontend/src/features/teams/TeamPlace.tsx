import { UserMinus } from 'lucide-react';
import { useState } from 'react';

import { getGenericErrorMessage } from '../../api/problemDetails';
import { DestructiveConfirmDialog } from '../../shared/overlays';
import { Select } from '../../shared/select';
import { Button } from '../../shared/ui/Button';
import { teamRoleLabel } from './teamLabels';
import { useTeamMembers } from './useTeamMembers';

export interface TeamPlaceProps {
  categoryId: string;
  userId: string;
  onRemoved: () => void;
}

/** Место одного человека в команде: его роль здесь и, если это не основная его команда, выход из неё. */
export function TeamPlace({ categoryId, userId, onRemoved }: TeamPlaceProps): JSX.Element | null {
  const { query, changeRole, remove, canManage } = useTeamMembers(categoryId);
  const [confirming, setConfirming] = useState(false);

  const member = query.data?.find((candidate) => candidate.userId === userId);
  if (member === undefined) return null;

  const roles = member.assignableRoles.includes(member.role) ? member.assignableRoles : [member.role, ...member.assignableRoles];
  const editable = canManage && member.assignableRoles.some((role) => role !== member.role);

  return (
    <section className="space-y-3 rounded-control border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink">Роль в команде</p>
          <p className="text-[12px] text-ink-muted">{member.isMain ? 'Это основная команда человека' : 'Добавлен в команду дополнительно'}</p>
        </div>
        {editable ? (
          <Select
            ariaLabel="Роль в команде"
            value={member.role}
            onValueChange={(role) => { if (role !== member.role) changeRole.mutate({ userId, role }); }}
            options={roles.map((role) => ({ value: role, label: teamRoleLabel(role) }))}
            disabled={changeRole.isPending}
            size="sm"
            fullWidth={false}
            className="w-[140px]"
          />
        ) : (
          <span className="text-[13px] font-medium text-ink">{teamRoleLabel(member.role)}</span>
        )}
      </div>

      {canManage && member.canRemove ? (
        <Button variant="secondary" size="sm" leadingIcon={<UserMinus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { setConfirming(true); }}>
          Убрать из команды
        </Button>
      ) : null}

      <DestructiveConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Убрать из команды"
        description={
          <>
            <span className="font-medium text-ink">{member.fullName}</span>{' '}
            <span>перестанет видеть эту команду. Остальные команды человека и история заданий сохранятся.</span>
          </>
        }
        confirmLabel="Убрать"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(userId);
          } catch (error) {
            throw new Error(getGenericErrorMessage(error));
          }
          setConfirming(false);
          onRemoved();
        }}
      />
    </section>
  );
}

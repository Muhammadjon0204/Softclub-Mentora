import { Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { useState } from 'react';

import { getGenericErrorMessage } from '../../api/problemDetails';
import type { TeamMemberDto } from '../../api/teams';
import { DestructiveConfirmDialog } from '../../shared/overlays';
import { Select } from '../../shared/select';
import { Badge } from '../../shared/ui/Badge';
import { Button, IconButton } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonRow } from '../../shared/ui/Skeleton';
import { UserAvatar } from '../avatars/UserAvatar';
import { AddTeamMemberDialog } from './AddTeamMemberDialog';
import { teamRoleLabel } from './teamLabels';
import { useTeamMembers } from './useTeamMembers';

export interface TeamMembersPanelProps {
  categoryId: string;
  teamName: string;
  /** Открыть карточку человека — там, где она есть. */
  onOpenUser?: (userId: string) => void;
}

/**
 * Все, кто в команде: те, для кого она основная, и те, кого в неё добавили. Что можно сделать с каждой
 * строкой, говорит сервер (`assignableRoles`, `canRemove`) — страница не гадает о правах.
 */
export function TeamMembersPanel({ categoryId, teamName, onOpenUser }: TeamMembersPanelProps): JSX.Element {
  const { query, add, changeRole, remove, canManage } = useTeamMembers(categoryId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TeamMemberDto | null>(null);

  let body: JSX.Element;
  if (query.isPending) {
    body = (
      <div className="divide-y divide-divider">
        <SkeletonRow columns={3} />
        <SkeletonRow columns={3} />
        <SkeletonRow columns={3} />
      </div>
    );
  } else if (query.isError) {
    body = <ErrorState error={query.error} onRetry={() => { void query.refetch(); }} />;
  } else if (query.data.length === 0) {
    body = (
      <EmptyState
        icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />}
        title="В команде пока никого"
        description="Добавьте тимлида, менторов и участников — из любого направления своего филиала."
      />
    );
  } else {
    body = (
      <ul className="divide-y divide-divider">
        {query.data.map((member) => (
          <MemberRow
            key={member.userId}
            member={member}
            canManage={canManage}
            busy={changeRole.isPending && changeRole.variables?.userId === member.userId}
            onOpen={onOpenUser}
            onRole={(role) => { changeRole.mutate({ userId: member.userId, role }); }}
            onRemove={() => { setRemoving(member); }}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[12.5px] font-semibold text-ink-secondary">
          <span>Участники команды</span>
          {query.data === undefined ? null : <span className="ml-1.5 tabular-nums text-ink-muted">{query.data.length}</span>}
        </h4>
        {canManage ? (
          <Button variant="secondary" size="sm" leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { setAdding(true); }}>
            Добавить участника
          </Button>
        ) : null}
      </div>

      <div className="rounded-control border border-line">{body}</div>

      <AddTeamMemberDialog
        categoryId={categoryId}
        teamName={teamName}
        open={adding}
        isSubmitting={add.isPending}
        onClose={() => { setAdding(false); }}
        onAdd={(userId, role) => add.mutateAsync({ userId, role })}
      />

      <DestructiveConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Убрать из команды"
        description={
          <>
            <span className="font-medium text-ink">{removing?.fullName}</span>{' '}
            <span>перестанет видеть эту команду. Остальные команды человека и история заданий сохранятся.</span>
          </>
        }
        confirmLabel="Убрать"
        onConfirm={async () => {
          if (removing === null) return;
          try {
            await remove.mutateAsync(removing.userId);
          } catch (error) {
            throw new Error(getGenericErrorMessage(error));
          }
          setRemoving(null);
        }}
      />
    </div>
  );
}

interface MemberRowProps {
  member: TeamMemberDto;
  canManage: boolean;
  busy: boolean;
  onOpen?: (userId: string) => void;
  onRole: (role: string) => void;
  onRemove: () => void;
}

function MemberRow({ member, canManage, busy, onOpen, onRole, onRemove }: MemberRowProps): JSX.Element {
  const roles = member.assignableRoles.includes(member.role) ? member.assignableRoles : [member.role, ...member.assignableRoles];
  const editable = canManage && member.assignableRoles.some((role) => role !== member.role);

  const identity = (
    <>
      <UserAvatar userId={member.userId} name={member.fullName} size={null} className="h-9 w-9 text-[11.5px]" fallbackClassName="bg-brand-soft text-brand" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink">{member.fullName}</span>
        <span className="block truncate text-[12px] text-ink-muted">
          {member.email}
          {member.isMain ? null : member.accountRole === 'Admin' ? <span> · администратор</span> : <span> · из другой команды</span>}
          {member.isActive ? null : <span> · деактивирован</span>}
        </span>
      </span>
    </>
  );

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      {onOpen === undefined ? (
        <div className="flex min-w-[200px] flex-1 items-center gap-3">{identity}</div>
      ) : (
        <button
          type="button"
          onClick={() => { onOpen(member.userId); }}
          className="flex min-w-[200px] flex-1 items-center gap-3 rounded-control-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {identity}
        </button>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {editable ? (
          <Select
            ariaLabel={`Роль в команде: ${member.fullName}`}
            value={member.role}
            onValueChange={(role) => { if (role !== member.role) onRole(role); }}
            options={roles.map((role) => ({ value: role, label: teamRoleLabel(role) }))}
            disabled={busy}
            size="sm"
            fullWidth={false}
            className="w-[132px]"
          />
        ) : (
          <Badge tone={member.role === 'Lead' ? 'info' : member.role === 'Mentor' ? 'brand' : 'neutral'}>{teamRoleLabel(member.role)}</Badge>
        )}
        {canManage && member.canRemove ? (
          <IconButton label={`Убрать из команды: ${member.fullName}`} size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        ) : (
          <span className="w-8" aria-hidden="true" />
        )}
      </div>
    </li>
  );
}

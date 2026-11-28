import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UserMinus, UserPlus, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { changeTeamRole, listTeamMembers, removeTeamMember, type TeamMember } from '@/api/teams';
import { useCan } from '@/features/assignments/queries';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { useAction, useConfirm } from '@/ui/feedback';
import { Avatar, Badge, Group, Row, Section } from '@/ui/kit';
import { Loaded } from '@/ui/page';
import { Sheet } from '@/ui/sheet';

import { AddMemberSheet } from './AddMemberSheet';
import { TEAM_ROLE_HINT, teamRoleLabel } from './labels';

/**
 * Everybody in one team: those whose main team it is and those added to it. Tapping a person offers
 * what the server allows for them — another role, leaving the team, their profile.
 */
export function TeamSection({ categoryId, branchId }: { categoryId: string; branchId?: string | null }): JSX.Element {
  const { t } = useT();
  const can = useCan();
  const manage = can('users.manage');
  const query = useQuery({ queryKey: ['team-members', categoryId], queryFn: () => listTeamMembers(categoryId) });
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <Section title={t('Команда')}>
      <Loaded query={query}>
        {(members) => (
          <Group>
            {members.length === 0 ? <Row title={t('Людей пока нет')} /> : null}
            {members.map((member) => (
              <Row
                key={member.userId}
                title={member.fullName}
                subtitle={[
                  member.isMain ? null : t(member.accountRole === 'Admin' ? 'Администратор' : 'Из другой команды'),
                  member.isActive ? null : t('Отключён'),
                ].filter(Boolean).join(' · ') || member.email}
                leading={<Avatar name={member.fullName} size={36} />}
                meta={<Badge label={t(teamRoleLabel(member.role))} tone={member.role === 'Lead' ? 'brand' : 'neutral'} />}
                onPress={() => setSelected(member)}
              />
            ))}
            {manage ? <Row title={t('Добавить из филиала')} icon={UserPlus} iconTone="brand" onPress={() => setAdding(true)} /> : null}
          </Group>
        )}
      </Loaded>

      {selected ? (
        <MemberSheet member={selected} categoryId={categoryId} branchId={branchId} manage={manage} onClose={() => setSelected(null)} />
      ) : null}
      {adding ? <AddMemberSheet categoryId={categoryId} branchId={branchId} onClose={() => setAdding(false)} /> : null}
    </Section>
  );
}

function MemberSheet({ member, categoryId, branchId, manage, onClose }: {
  member: TeamMember;
  categoryId: string;
  branchId?: string | null;
  manage: boolean;
  onClose: () => void;
}): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const confirm = useConfirm();
  const change = useAction((role: string) => changeTeamRole(categoryId, member.userId, role, branchId), {
    success: 'Роль в команде изменена',
    onDone: onClose,
  });
  const remove = useAction(() => removeTeamMember(categoryId, member.userId, branchId), {
    success: 'Участник убран из команды',
    onDone: onClose,
  });
  const roles = manage ? member.assignableRoles : [];
  const editable = roles.some((role) => role !== member.role);

  return (
    <Sheet open onClose={onClose} title={member.fullName}>
      {editable ? (
        <Section title={t('Роль в команде')}>
          <Group>
            {roles.map((role) => (
              <Row
                key={role}
                title={t(teamRoleLabel(role))}
                subtitle={TEAM_ROLE_HINT[role] ? t(TEAM_ROLE_HINT[role]) : null}
                selected={role === member.role}
                onPress={role === member.role || change.busy ? undefined : () => change.run(role)}
              />
            ))}
          </Group>
        </Section>
      ) : (
        <Text style={{ color: c.textSecondary, fontSize: 15 }}>{`${t('Роль в команде')}: ${t(teamRoleLabel(member.role))}`}</Text>
      )}
      <Group>
        <Row
          title={t('Открыть профиль')}
          icon={UserRound}
          onPress={() => {
            onClose();
            router.push({ pathname: '/users/[id]', params: { id: member.userId } });
          }}
        />
        {manage && member.canRemove ? (
          <Row
            title={t('Убрать из команды')}
            icon={UserMinus}
            iconTone="danger"
            danger
            onPress={() =>
              confirm(
                t('Убрать из команды?'),
                t('Остальные команды человека и история заданий сохранятся.'),
                t('Убрать'),
                () => remove.run(),
                true,
              )
            }
          />
        ) : null}
      </Group>
    </Sheet>
  );
}

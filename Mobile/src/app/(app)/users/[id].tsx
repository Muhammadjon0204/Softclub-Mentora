import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { KeyRound, MailPlus, PencilLine, Shuffle, Tags, UserCheck, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { listCategories } from '@/api/categories';
import { changeCategory, changeRole, getUser, renameUser, resendInvitation, setUserActive, type User } from '@/api/users';
import { Space } from '@/constants/theme';
import { useAssignments, useCan } from '@/features/assignments/queries';
import { isActionable, STATUS_LABEL, STATUS_TONE } from '@/features/assignments/status';
import { teamRoleLabel } from '@/features/teams/labels';
import { userStatus, USER_ROLE_LABEL } from '@/features/users/presentation';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { useAction, useConfirm } from '@/ui/feedback';
import { Avatar, Badge, Button, Group, Info, Row, Section, Stats } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Field } from '@/ui/primitives';
import { Select, Sheet } from '@/ui/sheet';

type Panel = 'rename' | 'role' | 'category' | null;

export default function UserScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['user', id], queryFn: () => getUser(id) });
  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>{(user) => <UserDetails user={user} />}</Loaded>
    </Page>
  );
}

function UserDetails({ user }: { user: User }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const me = useUser();
  const can = useCan();
  const confirm = useConfirm();
  const [panel, setPanel] = useState<Panel>(null);
  const categories = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  const assignments = useAssignments();
  const tasks = (assignments.data ?? []).filter((a) => a.assignedToId === user.id);
  const open = tasks.filter((a) => isActionable(a.status));
  const category = categories.data?.find((x) => x.id === user.categoryId);
  const status = userStatus(user);

  const isSelf = user.id === me.id;
  const admin = me.role === 'Admin';
  // A branch admin manages leads and mentors; only the organization admin manages administrators.
  const manageable = !isSelf && (me.adminScope === 'Organization' || user.role !== 'Admin');
  const mayManage = admin && manageable && can('users.manage');
  const mayInvite = manageable && me.role !== 'Mentor' && user.isActive && !user.hasPassword && can('users.manage');

  const invite = useAction(() => resendInvitation(user), { success: 'Приглашение отправлено повторно' });
  const toggle = useAction((active: boolean) => setUserActive(user, active), { success: 'Сохранено' });

  return (
    <>
      <Stack.Screen options={{ title: user.fullName }} />
      <View style={{ alignItems: 'center', gap: Space.sm }}>
        <Avatar name={user.fullName} size={72} />
        <Text style={{ color: c.text, fontSize: 21, fontWeight: '700', textAlign: 'center' }}>{user.fullName}</Text>
        <Text style={{ color: c.textMuted, fontSize: 14 }} selectable>{user.email}</Text>
        <View>
          <Badge label={t(status.label)} tone={status.tone} />
        </View>
      </View>

      <Group>
        <Info label={t('Роль')} value={t(user.role === 'Admin' ? (user.adminScope === 'Organization' ? 'Администратор организации' : 'Администратор филиала') : USER_ROLE_LABEL[user.role])} />
        {user.branch ? <Info label={t('Филиал')} value={user.branch.name} /> : null}
        {category ? <Info label={t('Направление')} value={category.name} /> : null}
        <Info label={t('Последний вход')} value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('Ещё не входил')} />
        <Info label={t('Добавлен')} value={new Date(user.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })} />
      </Group>

      {user.teams?.some((team) => !team.isMain || team.role === 'Member') ? (
        <Section title={t('Команды')}>
          <Group>
            {user.teams.map((team) => (
              <Info key={team.categoryId} label={team.name} value={t(teamRoleLabel(team.role))} />
            ))}
          </Group>
        </Section>
      ) : null}

      {mayInvite ? <Button label={t('Отправить приглашение ещё раз')} icon={MailPlus} onPress={() => invite.run()} loading={invite.busy} /> : null}

      {mayManage || (admin && !isSelf && can('permissions.manage') && user.role !== 'Admin') ? (
        <Section title={t('Управление')}>
          <Group>
            {mayManage ? <Row title={t('Изменить имя')} icon={PencilLine} onPress={() => setPanel('rename')} /> : null}
            {mayManage && user.role !== 'Admin' ? <Row title={t('Изменить роль')} icon={Shuffle} onPress={() => setPanel('role')} /> : null}
            {mayManage && user.role !== 'Admin' ? <Row title={t('Перевести в другое направление')} icon={Tags} onPress={() => setPanel('category')} /> : null}
            {admin && !isSelf && can('permissions.manage') && user.role !== 'Admin' ? (
              <Row title={t('Права доступа')} icon={KeyRound} onPress={() => router.push({ pathname: '/permissions/[userId]', params: { userId: user.id } })} />
            ) : null}
            {mayManage ? (
              user.isActive ? (
                <Row
                  title={t('Отключить доступ')}
                  icon={UserX}
                  iconTone="danger"
                  danger
                  onPress={() => confirm(t('Отключить доступ?'), t('Человек не сможет войти, пока вы не включите его снова.'), t('Отключить'), () => toggle.run(false), true)}
                />
              ) : (
                <Row title={t('Включить доступ')} icon={UserCheck} iconTone="success" onPress={() => toggle.run(true)} />
              )
            ) : null}
          </Group>
        </Section>
      ) : null}

      {user.role !== 'Admin' ? (
        <>
          <Stats
            items={[
              { label: t('В работе'), value: open.length },
              { label: t('Просрочено'), value: tasks.filter((a) => a.status === 'Overdue').length, tone: 'danger' },
              { label: t('Принято'), value: tasks.filter((a) => a.status === 'Approved').length, tone: 'success' },
              { label: t('Всего заданий'), value: tasks.length },
            ]}
          />
          {tasks.length > 0 ? (
            <Section title={t('Задания')}>
              <Group>
                {[...tasks]
                  .sort((x, y) => Number(isActionable(y.status)) - Number(isActionable(x.status)) || Date.parse(y.currentDueAt) - Date.parse(x.currentDueAt))
                  .slice(0, 10)
                  .map((a) => (
                    <Row
                      key={a.id}
                      title={a.title}
                      subtitle={new Date(a.currentDueAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      meta={<Badge label={t(STATUS_LABEL[a.status])} tone={STATUS_TONE[a.status]} />}
                      onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: a.id } })}
                    />
                  ))}
              </Group>
            </Section>
          ) : null}
        </>
      ) : null}

      {panel === 'rename' ? <RenamePanel user={user} onClose={() => setPanel(null)} /> : null}
      {panel === 'role' ? <RolePanel user={user} onClose={() => setPanel(null)} /> : null}
      {panel === 'category' ? <CategoryPanel user={user} onClose={() => setPanel(null)} /> : null}
    </>
  );
}

function RenamePanel({ user, onClose }: { user: User; onClose: () => void }): JSX.Element {
  const { t } = useT();
  const [name, setName] = useState(user.fullName);
  const save = useAction(() => renameUser(user, name.trim()), { success: 'Сохранено', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Изменить имя')}>
      <Field label={t('Имя и фамилия')} value={name} onChangeText={setName} maxLength={200} autoCapitalize="words" />
      <Button label={t('Сохранить')} onPress={() => save.run()} loading={save.busy} disabled={name.trim().length < 2 || name.trim() === user.fullName} />
    </Sheet>
  );
}

function useCategoryOptions(user: User) {
  const me = useUser();
  const categories = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  return (categories.data ?? []).filter((x) => x.isActive && x.branchId === user.branchId).map((x) => ({ value: x.id, label: x.name }));
}

function RolePanel({ user, onClose }: { user: User; onClose: () => void }): JSX.Element {
  const { t } = useT();
  const options = useCategoryOptions(user);
  const [role, setRole] = useState<User['role']>(user.role === 'Lead' ? 'Mentor' : 'Lead');
  const [categoryId, setCategoryId] = useState<string | null>(user.categoryId ?? null);
  const [reason, setReason] = useState('');
  const save = useAction(() => changeRole(user, role, reason.trim(), categoryId), { success: 'Роль изменена', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Изменить роль')}>
      <Select
        label={t('Новая роль')}
        value={role}
        onChange={setRole}
        options={(['Lead', 'Mentor'] as const).filter((r) => r !== user.role).map((r) => ({ value: r, label: t(USER_ROLE_LABEL[r]) }))}
      />
      <Select label={t('Направление')} value={categoryId} onChange={setCategoryId} options={options} />
      <Field label={t('Причина')} value={reason} onChangeText={setReason} multiline maxLength={500} placeholder={t('Не меньше 5 символов')} />
      <Button label={t('Изменить роль')} onPress={() => save.run()} loading={save.busy} disabled={!categoryId || reason.trim().length < 5} />
    </Sheet>
  );
}

function CategoryPanel({ user, onClose }: { user: User; onClose: () => void }): JSX.Element {
  const { t } = useT();
  const options = useCategoryOptions(user).filter((o) => o.value !== user.categoryId);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const save = useAction(() => changeCategory(user, categoryId as string, reason.trim()), { success: 'Сохранено', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Перевести в другое направление')}>
      <Select label={t('Новое направление')} value={categoryId} onChange={setCategoryId} options={options} />
      <Field label={t('Причина')} value={reason} onChangeText={setReason} multiline maxLength={500} placeholder={t('Не меньше 5 символов')} />
      <Button label={t('Перевести')} onPress={() => save.run()} loading={save.busy} disabled={!categoryId || reason.trim().length < 5} />
    </Sheet>
  );
}

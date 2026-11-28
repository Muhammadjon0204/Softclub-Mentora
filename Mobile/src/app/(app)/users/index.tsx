import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';

import { listCategories } from '@/api/categories';
import { listTeamMembers } from '@/api/teams';
import { listUsers } from '@/api/users';
import { useCan } from '@/features/assignments/queries';
import { TeamSection } from '@/features/teams/TeamSection';
import { userStatus, USER_ROLE_LABEL } from '@/features/users/presentation';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Avatar, Badge, Chips, Fab, Group, Row, SearchBar } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';

type Filter = 'all' | 'Admin' | 'Lead' | 'Mentor' | 'invited' | 'off';

/** An administrator manages accounts; a lead — the people of their own team. */
export default function UsersScreen(): JSX.Element {
  const me = useUser();
  return me.role === 'Lead' && me.category ? <MyTeam categoryId={me.category.id} /> : <Accounts />;
}

function MyTeam({ categoryId }: { categoryId: string }): JSX.Element {
  const { t } = useT();
  const can = useCan();
  const query = useQuery({ queryKey: ['team-members', categoryId], queryFn: () => listTeamMembers(categoryId) });
  return (
    <Page
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      floating={can('users.manage') ? <Fab label={t('Новый аккаунт')} icon={UserPlus} onPress={() => router.push('/users/new')} /> : null}
    >
      <Stack.Screen options={{ title: t('Команда') }} />
      <TeamSection categoryId={categoryId} />
    </Page>
  );
}

function Accounts(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const me = useUser();
  const can = useCan();
  const query = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const categories = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((x) => [x.id, x.name])), [categories.data]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const admin = me.role === 'Admin';

  const matches = (u: NonNullable<typeof query.data>[number], f: Filter) =>
    f === 'all' ? u.isActive : f === 'off' ? !u.isActive : f === 'invited' ? u.isActive && !u.hasPassword : u.isActive && u.role === f;

  const all = query.data ?? [];
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t('Все') },
    ...(admin ? [{ value: 'Admin' as const, label: t('Админы') }] : []),
    { value: 'Lead', label: t('Тимлиды') },
    { value: 'Mentor', label: t('Менторы') },
    { value: 'invited', label: t('Приглашены') },
    { value: 'off', label: t('Отключённые') },
  ];

  return (
    <Page
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      floating={can('users.manage') && me.role !== 'Mentor' ? <Fab label={t('Добавить')} icon={UserPlus} onPress={() => router.push('/users/new')} /> : null}
    >
      <SearchBar value={search} onChange={setSearch} placeholder={t('Имя или email')} />
      <Chips value={filter} onChange={setFilter} options={filters.map((f) => ({ ...f, count: query.data ? all.filter((u) => matches(u, f.value)).length : undefined }))} />
      <Loaded query={query}>
        {(users) => {
          const needle = search.trim().toLowerCase();
          const shown = users
            .filter((u) => matches(u, filter) && (!needle || `${u.fullName} ${u.email}`.toLowerCase().includes(needle)))
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
          if (shown.length === 0) return <Text style={{ color: c.textMuted, textAlign: 'center' }}>{t('Ничего не найдено')}</Text>;
          return (
            <Group>
              {shown.map((u) => {
                const status = userStatus(u);
                return (
                  <Row
                    key={u.id}
                    title={u.fullName}
                    subtitle={[t(USER_ROLE_LABEL[u.role]), categoryName.get(u.categoryId ?? ''), me.adminScope === 'Organization' ? u.branch?.name : null].filter(Boolean).join(' · ')}
                    leading={<Avatar name={u.fullName} />}
                    meta={status.label !== 'Активен' ? <Badge label={t(status.label)} tone={status.tone} /> : undefined}
                    onPress={() => router.push({ pathname: '/users/[id]', params: { id: u.id } })}
                  />
                );
              })}
            </Group>
          );
        }}
      </Loaded>
    </Page>
  );
}

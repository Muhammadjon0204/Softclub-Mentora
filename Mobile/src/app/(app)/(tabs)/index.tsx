import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { listBranches } from '@/api/admin';
import { Space } from '@/constants/theme';
import { roleLabel } from '@/features/journal/api';
import { AdminOverview } from '@/features/overview/AdminOverview';
import { TeamOverview } from '@/features/overview/TeamOverview';
import { TeamPicker } from '@/features/teams/TeamPicker';
import { setBranchScope, useBranchScope } from '@/lib/branchScope';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Screen } from '@/ui/Screen';
import { Select } from '@/ui/sheet';

export default function OverviewScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const orgAdmin = user.role === 'Admin' && user.adminScope === 'Organization';

  return (
    <Screen
      title={t('Обзор')}
      subtitle={[t(roleLabel(user)), user.category?.name, user.branch?.name].filter(Boolean).join(' · ')}
    >
      <ScrollView
        contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: Space.xxl * 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.brand}
            onRefresh={() => {
              setRefreshing(true);
              void queryClient.invalidateQueries().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <TeamPicker />
        {orgAdmin ? <BranchPicker /> : null}
        {user.role === 'Admin' ? <AdminOverview /> : <TeamOverview />}
      </ScrollView>
    </Screen>
  );
}

/** The organization administrator's «Все филиалы» switch; it narrows every screen of the app. */
function BranchPicker(): JSX.Element {
  const { t } = useT();
  const queryClient = useQueryClient();
  const scope = useBranchScope();
  const branches = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const options = [
    { value: 'all', label: t('Все филиалы') },
    ...(branches.data?.items ?? []).map((b) => ({ value: b.id, label: b.name })),
  ];
  return (
    <Select
      label={t('Филиал')}
      value={scope?.id ?? 'all'}
      options={options}
      onChange={(id) => {
        const branch = branches.data?.items.find((b) => b.id === id);
        setBranchScope(branch ? { id: branch.id, name: branch.name } : null);
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'branches' });
      }}
    />
  );
}

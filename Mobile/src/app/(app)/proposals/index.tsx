import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';

import { listProposals, type ProposalStatus } from '@/api/work';
import { useCan } from '@/features/assignments/queries';
import { PROPOSAL_KIND, PROPOSAL_STATUS } from '@/features/proposals/presentation';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { Badge, Chips, Fab, Group, Row } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { StateMessage } from '@/ui/primitives';

type Filter = ProposalStatus | 'all';

export default function ProposalsScreen(): JSX.Element {
  const { t, locale } = useT();
  const me = useUser();
  const can = useCan();
  const query = useQuery({ queryKey: ['proposals', me.id], queryFn: listProposals });
  const [filter, setFilter] = useState<Filter>('Pending');
  const mentor = me.role === 'Mentor';
  const all = query.data ?? [];
  const filters: Filter[] = ['Pending', 'Approved', 'Rejected', 'all'];

  return (
    <Page
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      floating={mentor && can('proposals.create') ? <Fab label={t('Предложить')} icon={Plus} onPress={() => router.push('/proposals/new')} /> : null}
    >
      <Chips
        value={filter}
        onChange={setFilter}
        options={filters.map((f) => ({
          value: f,
          label: t(f === 'all' ? 'Все' : PROPOSAL_STATUS[f].label),
          count: query.data ? all.filter((p) => f === 'all' || p.status === f).length : undefined,
        }))}
      />
      <Loaded query={query}>
        {(items) => {
          const shown = items.filter((p) => filter === 'all' || p.status === filter);
          if (shown.length === 0) {
            return <StateMessage title={t('Здесь пока пусто')} detail={mentor ? t('Предложите мастер-класс, дополнительный урок или свою идею.') : t('Идеи менторов появятся здесь.')} />;
          }
          return (
            <Group>
              {shown.map((p) => (
                <Row
                  key={p.id}
                  title={p.title}
                  subtitle={[t(PROPOSAL_KIND[p.kind].label), mentor ? null : p.authorFullName, new Date(p.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                  icon={PROPOSAL_KIND[p.kind].icon}
                  iconTone="brand"
                  meta={<Badge label={t(PROPOSAL_STATUS[p.status].label)} tone={PROPOSAL_STATUS[p.status].tone} />}
                  onPress={() => router.push({ pathname: '/proposals/[id]', params: { id: p.id } })}
                />
              ))}
            </Group>
          );
        }}
      </Loaded>
    </Page>
  );
}

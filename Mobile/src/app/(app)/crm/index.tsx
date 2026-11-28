import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PlugZap, School } from 'lucide-react-native';
import { useState } from 'react';
import { Linking } from 'react-native';

import { getCrmAccess, getCrmGroups, getCrmStatus, type CrmGroupStatus } from '@/api/crm';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { Badge, Button, Chips, Group, Row, SearchBar } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { StateMessage } from '@/ui/primitives';

export default function CrmScreen(): JSX.Element {
  const { t, locale } = useT();
  const me = useUser();
  const orgAdmin = me.adminScope === 'Organization';
  const access = useQuery({ queryKey: ['crm', 'access', me.id], queryFn: getCrmAccess });
  const status = useQuery({ queryKey: ['crm', 'status'], queryFn: getCrmStatus, enabled: orgAdmin });
  const [tab, setTab] = useState<CrmGroupStatus>('Started');
  const [search, setSearch] = useState('');
  const groups = useQuery({ queryKey: ['crm', 'groups', me.id, tab], queryFn: () => getCrmGroups(tab), enabled: access.data?.ready === true });
  const date = (day: string) => new Date(day).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <Page onRefresh={() => void Promise.all([access.refetch(), groups.refetch(), status.refetch()])} refreshing={groups.isRefetching}>
      {orgAdmin && status.data ? (
        <Group>
          <Row
            title="Omuz CRM"
            subtitle={status.data.error ?? (status.data.latencyMs != null ? `${t('Ответ за')} ${status.data.latencyMs} ms` : null)}
            icon={PlugZap}
            iconTone={status.data.connected ? 'success' : 'danger'}
            trailing={<Badge tone={status.data.connected ? 'success' : 'danger'} label={t(status.data.connected ? 'Подключено' : 'Нет связи')} />}
          />
        </Group>
      ) : null}
      <Loaded query={access}>
        {(a) =>
          !a.ready ? (
            <>
              <StateMessage title={t('Группы пока недоступны')} detail={a.message ?? undefined} />
              {a.canSelfLink && a.botUrl ? <Button label={t('Связать через Telegram-бота')} onPress={() => void Linking.openURL(a.botUrl as string)} /> : null}
            </>
          ) : (
            <>
              <Chips
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'Started', label: t('Идут') },
                  { value: 'Finished', label: t('Закончились') },
                  { value: 'Preparing', label: t('Набор') },
                ]}
              />
              <SearchBar value={search} onChange={setSearch} placeholder={t('Группа, курс или ментор')} />
              <Loaded query={groups}>
                {(items) => {
                  const needle = search.trim().toLowerCase();
                  const shown = items.filter((g) => !needle || `${g.name} ${g.course.name} ${g.currentMentors.join(' ')}`.toLowerCase().includes(needle));
                  if (shown.length === 0) return <StateMessage title={t('Ничего не найдено')} />;
                  return (
                    <Group>
                      {shown.map((g) => (
                        <Row
                          key={g.id}
                          title={g.name}
                          subtitle={`${g.course.name} · ${date(g.startsOn)} — ${date(g.finishesOn)} · ${t('Студенты')}: ${g.enrolledStudents}/${g.requiredStudents}${g.currentMentors.length ? `\n${g.currentMentors.join(', ')}` : ''}`}
                          icon={School}
                          iconTone="brand"
                          onPress={() => router.push({ pathname: '/crm/[id]', params: { id: String(g.id) } })}
                        />
                      ))}
                    </Group>
                  );
                }}
              </Loaded>
            </>
          )
        }
      </Loaded>
    </Page>
  );
}

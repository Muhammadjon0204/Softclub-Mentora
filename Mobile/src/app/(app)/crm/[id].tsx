import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { getCrmGroup, type CrmGroupPreview } from '@/api/crm';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { Badge, Chips, Group, Row, Section, Stats } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { StateMessage } from '@/ui/primitives';

const ZONE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  Passed: { label: 'Хорошо', tone: 'success' },
  Support: { label: 'Нужна помощь', tone: 'warning' },
  Risk: { label: 'Зона риска', tone: 'danger' },
};

export default function CrmGroupScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['crm', 'group', id], queryFn: () => getCrmGroup(Number(id)) });
  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>{(data) => <Details data={data} />}</Loaded>
    </Page>
  );
}

function Details({ data }: { data: CrmGroupPreview }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const [week, setWeek] = useState('all');
  const period = data.periods.find((p) => String(p.week) === week);
  const summary = period ? period.summary : data.overall;
  const date = (day: string) => new Date(day).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const rows = period
    ? period.students.map((s) => ({ id: s.studentId, name: s.fullName, score: s.total as number | null | undefined, zone: s.zone, attended: s.attended, absent: s.absent }))
    : data.overall.studentResults.map((s) => ({ id: s.studentId, name: s.fullName, score: s.averageTotal, zone: s.zone, attended: s.attended, absent: s.absent }));

  return (
    <>
      <Stack.Screen options={{ title: data.group.name }} />
      <Text style={{ color: c.textMuted, fontSize: 14 }}>
        {data.group.course.name} · {data.group.branch.name} · {date(data.group.startsOn)} — {date(data.group.finishesOn)}
      </Text>
      {data.mentors.length > 0 ? (
        <Section title={t('Менторы')}>
          <Group>
            {data.mentors.map((m) => (
              <Row key={`${m.id}-${m.from}`} title={m.fullName} subtitle={`${date(m.from)}${m.to ? ` — ${date(m.to)}` : ''}`} />
            ))}
          </Group>
        </Section>
      ) : null}
      {data.journalUnavailable || data.periods.length === 0 ? (
        <StateMessage title={t('Журнала пока нет')} detail={data.journalUnavailable ?? undefined} />
      ) : (
        <>
          <Chips value={week} onChange={setWeek} options={[{ value: 'all', label: t('Итог') }, ...data.periods.map((p) => ({ value: String(p.week), label: p.label }))]} />
          <Stats
            items={[
              { label: t('Средний балл'), value: summary.averageTotal == null ? '—' : Math.round(summary.averageTotal * 10) / 10 },
              { label: t('Посещаемость'), value: summary.attendanceRate == null ? '—' : `${Math.round(summary.attendanceRate * 10) / 10}%` },
              { label: t('Хорошо'), value: summary.passed, tone: 'success' },
              { label: t('Зона риска'), value: summary.risk, tone: 'danger' },
            ]}
          />
          <Section title={t('Студенты')}>
            <Group>
              {rows.map((s) => {
                const zone = ZONE[s.zone ?? ''];
                return (
                  <Row
                    key={s.id}
                    title={s.name}
                    subtitle={`${t('Был')}: ${s.attended} · ${t('Пропустил')}: ${s.absent}`}
                    meta={zone ? <Badge tone={zone.tone} label={t(zone.label)} /> : undefined}
                    trailing={<Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{s.score == null ? '—' : Math.round(s.score)}</Text>}
                  />
                );
              })}
            </Group>
          </Section>
        </>
      )}
    </>
  );
}

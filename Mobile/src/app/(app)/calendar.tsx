import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import type { Assignment } from '@/features/assignments/api';
import { AssignmentRow } from '@/features/assignments/AssignmentRow';
import { sectionOf } from '@/features/assignments/grouping';
import { useAssignments, usePeopleNames } from '@/features/assignments/queries';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { dayKey, MonthGrid } from '@/ui/date';
import { Card, Group, Row, Section } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';

/** Deadlines by day: a red dot — something overdue, a coloured one — still open, grey — finished. */
export default function CalendarScreen(): JSX.Element {
  const { t, locale } = useT();
  const me = useUser();
  const query = useAssignments();
  const nameOf = usePeopleNames();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [openedAt] = useState(() => Date.now());
  const loadedAt = query.dataUpdatedAt || openedAt;

  const byDay = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of query.data ?? []) {
      if (a.status === 'Draft' || a.status === 'Suggested' || a.status === 'Cancelled') continue;
      const key = dayKey(new Date(a.currentDueAt));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [query.data]);

  const marks = useMemo(() => {
    const now = new Date(loadedAt);
    const result = new Map<string, 'danger' | 'brand' | 'muted'>();
    for (const [key, items] of byDay) {
      const sections = items.map((a) => sectionOf(a, now));
      result.set(key, sections.includes('overdue') ? 'danger' : sections.some((s) => s && s !== 'done') ? 'brand' : 'muted');
    }
    return result;
  }, [byDay, loadedAt]);

  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Card>
        <MonthGrid month={month} onMonth={setMonth} selected={selected} onSelect={setSelected} marks={marks} />
      </Card>
      <Loaded query={query}>
        {() => {
          const items = [...(byDay.get(dayKey(selected)) ?? [])].sort((a, b) => Date.parse(a.currentDueAt) - Date.parse(b.currentDueAt));
          return (
            <Section title={selected.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}>
              <Group>
                {items.length === 0 ? <Row title={t('На этот день сроков нет')} /> : null}
                {items.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} section={sectionOf(a, new Date(loadedAt)) ?? 'later'} person={me.role === 'Mentor' || a.assignedToId === me.id ? null : nameOf(a.assignedToId)} />
                ))}
              </Group>
            </Section>
          );
        }}
      </Loaded>
      {me.role !== 'Mentor' ? (
        <Group>
          <Row title={t('Выдать задание')} onPress={() => router.push('/assignment/new')} />
        </Group>
      ) : null}
    </Page>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { Space } from '@/constants/theme';
import type { Assignment } from '@/features/assignments/api';
import { AssignmentRow, RowSeparator } from '@/features/assignments/AssignmentRow';
import { groupAssignments, SECTION_TITLE, sectionOf, type AssignmentSection, type SectionKey } from '@/features/assignments/grouping';
import { useAssignments, useCan, usePeopleNames } from '@/features/assignments/queries';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Chips, Fab, SearchBar } from '@/ui/kit';
import { SecondaryButton, StateMessage } from '@/ui/primitives';
import { Screen, Segmented } from '@/ui/Screen';

type Filter = 'open' | 'overdue' | 'review' | 'rework' | 'done' | 'draft';

const FILTERS: { value: Filter; label: string; managersOnly?: boolean }[] = [
  { value: 'open', label: 'Активные' },
  { value: 'overdue', label: 'Просрочено' },
  { value: 'review', label: 'На проверке' },
  { value: 'rework', label: 'На доработке' },
  { value: 'done', label: 'Завершённые' },
  { value: 'draft', label: 'Черновики', managersOnly: true },
];

function matches(a: Assignment, filter: Filter, now: Date): boolean {
  const section = sectionOf(a, now);
  switch (filter) {
    case 'open':
      return section !== null && section !== 'done';
    case 'overdue':
      return section === 'overdue';
    case 'review':
      return section === 'review';
    case 'rework':
      return a.status === 'NeedsRework';
    case 'done':
      return section === 'done';
    case 'draft':
      return a.status === 'Draft' || a.status === 'Suggested';
  }
}

export default function AssignmentsScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const can = useCan();
  const query = useAssignments();
  const nameOf = usePeopleNames();
  const params = useLocalSearchParams<{ filter?: string; at?: string }>();
  const requested = FILTERS.find((f) => f.value === params.filter)?.value;
  const [filter, setFilter] = useState<Filter>(requested ?? 'open');
  const [openedAt] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  // A lead both hands work out and receives it; the two lists are not mixed.
  const [scope, setScope] = useState<'team' | 'mine'>('team');
  const isMentor = user.role === 'Mentor';
  const ownWork = isMentor || (user.role === 'Lead' && scope === 'mine');

  // The overview's tiles open this list already filtered; `at` tells a repeated tap from the same one.
  const request = `${params.filter ?? ''}:${params.at ?? ''}`;
  const [applied, setApplied] = useState(request);
  if (request !== applied) {
    setApplied(request);
    if (requested) setFilter(requested);
  }
  // «Now» is the moment the list was loaded, so a render never depends on the clock.
  const loadedAt = query.dataUpdatedAt || openedAt;

  const inScope = useMemo(() => {
    const all = query.data ?? [];
    return user.role === 'Lead' ? all.filter((a) => (a.assignedToId === user.id) === (scope === 'mine')) : all;
  }, [query.data, user, scope]);

  const sections: AssignmentSection[] = useMemo(() => {
    const now = new Date(loadedAt);
    const needle = search.trim().toLowerCase();
    const found = inScope.filter(
      (a) => matches(a, filter, now) && (!needle || `${a.title} ${nameOf(a.assignedToId) ?? ''}`.toLowerCase().includes(needle)),
    );
    if (filter === 'draft') return found.length ? [{ key: 'later', data: found }] : [];
    if (filter === 'done') {
      const finished = [...found].sort((x, y) => Date.parse(y.approvedAt ?? y.currentDueAt) - Date.parse(x.approvedAt ?? x.currentDueAt));
      return finished.length ? [{ key: 'done', data: finished }] : [];
    }
    return groupAssignments(found, now);
  }, [inScope, filter, search, nameOf, loadedAt]);

  const chips = FILTERS.filter((f) => !f.managersOnly || !ownWork).map((f) => {
    const now = new Date(loadedAt);
    return { value: f.value, label: t(f.label), count: query.data ? inScope.filter((a) => matches(a, f.value, now)).length : undefined };
  });
  const mayIssue = !isMentor && can('assignments.assign');

  let body: JSX.Element;
  if (query.isPending) {
    body = <StateMessage loading title={t('Загружаем задания…')} />;
  } else if (query.isError) {
    body = (
      <StateMessage
        title={t('Не удалось загрузить задания')}
        detail={t(query.error.message)}
        action={<SecondaryButton label={t('Повторить')} onPress={() => void query.refetch()} />}
      />
    );
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: mayIssue ? 96 : Space.xxl }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
        ListEmptyComponent={<StateMessage title={search ? t('Ничего не найдено') : t('Здесь пока пусто')} />}
        renderSectionHeader={({ section }) => (filter === 'draft' ? null : <SectionHeader sectionKey={section.key} count={section.data.length} />)}
        renderItem={({ item, section }) => (
          <AssignmentRow assignment={item} section={section.key} person={ownWork ? null : nameOf(item.assignedToId)} />
        )}
        ItemSeparatorComponent={RowSeparator}
      />
    );
  }

  return (
    <Screen
      title={isMentor ? t('Мои задания') : t('Задания')}
      header={
        <View style={{ gap: Space.sm, marginTop: Space.sm }}>
          {user.role === 'Lead' ? (
            <Segmented
              value={scope}
              onChange={(next) => {
                setScope(next);
                setFilter('open');
              }}
              options={[
                { value: 'team', label: t('Команда') },
                { value: 'mine', label: t('Мои') },
              ]}
            />
          ) : null}
          <SearchBar value={search} onChange={setSearch} placeholder={ownWork ? t('Поиск по названию') : t('Название или исполнитель')} />
          <Chips value={filter} onChange={setFilter} options={chips} />
        </View>
      }
    >
      {body}
      {mayIssue ? <Fab label={t('Выдать задание')} icon={Plus} onPress={() => router.push('/assignment/new')} /> : null}
    </Screen>
  );
}

function SectionHeader({ sectionKey, count }: { sectionKey: SectionKey; count: number }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const color = sectionKey === 'overdue' ? c.danger : c.textSecondary;
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color }]}>{t(SECTION_TITLE[sectionKey])}</Text>
      <Text style={{ fontSize: 13, color: c.textMuted }}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm, paddingHorizontal: Space.lg, paddingTop: Space.lg, paddingBottom: Space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
});

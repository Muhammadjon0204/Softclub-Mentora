import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { EVENT_LABEL } from '@/features/assignments/status';
import { CHANGE_LABEL, JOURNAL_FILTERS, listJournal, roleLabel, type JournalChange, type JournalEntry } from '@/features/journal/api';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { SecondaryButton, StateMessage } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';

type FilterKey = (typeof JOURNAL_FILTERS)[number]['key'];

/** Everything that happened to the tasks this person can see; the server decides the scope. */
export default function JournalScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const [filter, setFilter] = useState<FilterKey>('all');
  const eventTypes = JOURNAL_FILTERS.find((f) => f.key === filter)?.eventTypes;

  const query = useInfiniteQuery({
    queryKey: ['journal', user.id, filter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listJournal(pageParam, eventTypes),
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
  });
  const entries = query.data?.pages.flatMap((p) => p.items) ?? [];

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsRow}>
      {JOURNAL_FILTERS.map((f) => {
        const active = f.key === filter;
        return (
          <Pressable
            key={f.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, { borderColor: active ? c.brand : c.border, backgroundColor: active ? c.brandSoft : c.surface }]}
          >
            <Text style={{ color: active ? c.brand : c.textSecondary, fontSize: 13, fontWeight: '600' }}>{t(f.label)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Screen title={t('Журнал')} subtitle={t('Записи нельзя изменить или удалить')} header={chips}>
      {query.isPending ? (
        <StateMessage loading title={t('Загрузка…')} />
      ) : query.isError ? (
        <StateMessage
          title={t('Не удалось загрузить журнал')}
          detail={t(query.error.message)}
          action={<SecondaryButton label={t('Повторить')} onPress={() => void query.refetch()} />}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={<StateMessage title={t('Записей пока нет')} />}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={c.brand} /> : undefined}
          renderItem={({ item }) => <Entry entry={item} />}
        />
      )}
    </Screen>
  );
}

function Entry({ entry }: { entry: JournalEntry }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const user = useUser();
  const bad = entry.eventType === 'MarkedOverdue' || entry.eventType === 'Cancelled';
  const when = new Date(entry.occurredAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const forSomeoneElse = entry.assignee && entry.assignee.id !== user.id && entry.assignee.id !== entry.actor?.id;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: entry.assignmentId } })}
      style={({ pressed }) => [styles.card, { borderColor: c.border, backgroundColor: pressed ? c.surfaceMuted : c.surface }]}
    >
      <View style={styles.top}>
        <Text style={[styles.event, { color: bad ? c.danger : c.text }]}>{t(EVENT_LABEL[entry.eventType] ?? entry.eventType)}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12 }}>{when}</Text>
      </View>
      <Text style={{ color: c.brand, fontSize: 14, fontWeight: '600' }} numberOfLines={2}>{entry.assignmentTitle}</Text>
      <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 18 }}>
        {entry.actor ? `${entry.actor.fullName} · ${t(roleLabel(entry.actor))}` : t('Система')}
        {forSomeoneElse ? ` → ${entry.assignee?.fullName ?? ''}` : ''}
      </Text>
      {entry.changes?.map((change) => <Change key={change.field} change={change} />)}
      {entry.note ? (
        <Text style={[styles.note, { color: c.textSecondary, borderLeftColor: c.border }]}>{entry.note}</Text>
      ) : null}
    </Pressable>
  );
}

function Change({ change }: { change: JournalChange }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const show = (value: string | null | undefined): string => {
    if (!value) return '—';
    if (change.field !== 'dueAt') return value;
    return new Date(value).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  return (
    <View style={[styles.change, { backgroundColor: c.surfaceMuted }]}>
      <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{t(CHANGE_LABEL[change.field] ?? change.field)}</Text>
      <Text style={{ color: c.textMuted, fontSize: 13, textDecorationLine: 'line-through' }} accessibilityLabel={`${t('было:')} ${show(change.before)}`}>
        {show(change.before)}
      </Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }} accessibilityLabel={`${t('стало:')} ${show(change.after)}`}>
        {show(change.after)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipsRow: { marginTop: Space.md, marginHorizontal: -Space.lg, flexGrow: 0 },
  chips: { gap: Space.sm, paddingHorizontal: Space.lg },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Space.md, minHeight: 36, justifyContent: 'center' },
  list: { padding: Space.lg, gap: Space.sm, paddingBottom: Space.xxl },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Space.md, gap: Space.xs + 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Space.sm },
  event: { flex: 1, fontSize: 15, fontWeight: '700' },
  change: { borderRadius: Radius.sm, padding: Space.sm, gap: 2, marginTop: Space.xs },
  note: { borderLeftWidth: 2, paddingLeft: Space.sm, fontSize: 13, lineHeight: 19 },
});

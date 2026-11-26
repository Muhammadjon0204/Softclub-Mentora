import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Space } from '@/constants/theme';
import { listMyAssignments, type Assignment } from '@/features/assignments/api';
import { groupAssignments, relativeDue, SECTION_TITLE, type SectionKey } from '@/features/assignments/grouping';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors, WEB_TAB_BAR_INSET } from '@/lib/useColors';
import { SecondaryButton, StateMessage, StatusPill } from '@/ui/primitives';

export default function AssignmentsScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const query = useQuery({ queryKey: ['assignments', user.id], queryFn: () => listMyAssignments(user.id) });
  const sections = useMemo(() => groupAssignments(query.data ?? []), [query.data]);
  const openCount = sections.filter((s) => s.key !== 'done' && s.key !== 'review').reduce((n, s) => n + s.data.length, 0);

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
        contentContainerStyle={{ paddingBottom: Space.xxl }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
        ListEmptyComponent={
          <StateMessage title={t('Заданий пока нет')} detail={t('Когда лид назначит задание, оно появится здесь.')} />
        }
        renderSectionHeader={({ section }) => <SectionHeader sectionKey={section.key} count={section.data.length} />}
        renderItem={({ item, section }) => <AssignmentRow assignment={item} section={section.key} />}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: c.divider }]} />}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background, paddingTop: WEB_TAB_BAR_INSET }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{t('Мои задания')}</Text>
        {query.isSuccess ? (
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {openCount === 0 ? t('Всё сдано') : `${t('В работе')}: ${openCount}`}
          </Text>
        ) : null}
      </View>
      {body}
    </SafeAreaView>
  );
}

function SectionHeader({ sectionKey, count }: { sectionKey: SectionKey; count: number }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const color = sectionKey === 'overdue' ? c.danger : c.textSecondary;
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color }]}>{t(SECTION_TITLE[sectionKey])}</Text>
      <Text style={[styles.sectionCount, { color: c.textMuted }]}>{count}</Text>
    </View>
  );
}

/**
 * The deadline leads the row: a mentor scans the left column to see what comes next. Today shows the
 * time, other days the date; overdue is red. Finished work shows no countdown.
 */
function AssignmentRow({ assignment: a, section }: { assignment: Assignment; section: SectionKey }): JSX.Element {
  const c = useColors();
  const { t, language, locale } = useT();
  const due = new Date(a.currentDueAt);
  const finished = section === 'done' || section === 'review';
  const overdue = section === 'overdue';
  const accent = overdue ? c.danger : finished ? c.textMuted : c.text;

  const top =
    section === 'today' ? due.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : String(due.getDate());
  const bottom =
    section === 'today' ? t('сегодня') : due.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  const relative = relativeDue(a.currentDueAt, language);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.title}. ${t(finished ? 'Срок был' : 'Срок')}: ${due.toLocaleString(locale)}`}
      onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: a.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceMuted : c.surface }]}
    >
      <View style={styles.dateCol}>
        <Text style={[section === 'today' ? styles.dateTime : styles.dateDay, { color: accent }]}>{top}</Text>
        <Text style={[styles.dateMonth, { color: overdue ? c.danger : c.textMuted }]}>{bottom}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: finished ? c.textSecondary : c.text }]} numberOfLines={2}>
          {a.title}
        </Text>
        <View style={styles.rowMeta}>
          {!finished ? (
            <Text style={[styles.rowMetaText, { color: relative.overdue ? c.danger : c.textMuted }]}>{relative.text}</Text>
          ) : null}
          {/* «Назначено» is the normal state and «Просрочено» is already the section title. */}
          {a.status !== 'Assigned' && a.status !== 'Overdue' ? <StatusPill status={a.status} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: Space.sm },
  title: { fontSize: 30, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm, paddingHorizontal: Space.lg, paddingTop: Space.xl, paddingBottom: Space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  sectionCount: { fontSize: 13 },
  row: { flexDirection: 'row', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: Space.md, minHeight: 64 },
  dateCol: { width: 52, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dateTime: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dateMonth: { fontSize: 12, marginTop: 1 },
  rowBody: { flex: 1, justifyContent: 'center', gap: Space.xs },
  rowTitle: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' },
  rowMetaText: { fontSize: 13 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Space.lg + 52 + Space.md },
});

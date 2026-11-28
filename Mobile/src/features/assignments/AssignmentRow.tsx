import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { StatusPill } from '@/ui/primitives';

import type { Assignment } from './api';
import { relativeDue, type SectionKey } from './grouping';

/**
 * The deadline leads the row: you scan the left column to see what comes next. Today shows the time,
 * other days the date; overdue is red. Finished work shows no countdown. `person` is whose task it is,
 * for leads and administrators.
 */
export function AssignmentRow({ assignment: a, section, person }: {
  assignment: Assignment;
  section: SectionKey;
  person?: string | null;
}): JSX.Element {
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
      accessibilityLabel={`${a.title}. ${person ?? ''} ${t(finished ? 'Срок был' : 'Срок')}: ${due.toLocaleString(locale)}`}
      onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: a.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceMuted : c.surface }]}
    >
      <View style={styles.dateCol}>
        <Text style={[section === 'today' ? styles.dateTime : styles.dateDay, { color: accent }]}>{top}</Text>
        <Text style={[styles.dateMonth, { color: overdue ? c.danger : c.textMuted }]}>{bottom}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: finished ? c.textSecondary : c.text }]} numberOfLines={2}>
          {a.title}
        </Text>
        {person ? <Text style={{ color: c.textSecondary, fontSize: 13 }} numberOfLines={1}>{person}</Text> : null}
        <View style={styles.meta}>
          {!finished ? (
            <Text style={{ fontSize: 13, color: relative.overdue ? c.danger : c.textMuted }}>{relative.text}</Text>
          ) : null}
          {/* «Назначено» is the normal state and «Просрочено» is already the section title. */}
          {a.status !== 'Assigned' && a.status !== 'Overdue' ? <StatusPill status={a.status} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function RowSeparator(): JSX.Element {
  const c = useColors();
  return <View style={[styles.separator, { backgroundColor: c.divider }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: Space.md, minHeight: 64 },
  dateCol: { width: 52, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dateTime: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dateMonth: { fontSize: 12, marginTop: 1 },
  body: { flex: 1, justifyContent: 'center', gap: Space.xs },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Space.lg + 52 + Space.md },
});

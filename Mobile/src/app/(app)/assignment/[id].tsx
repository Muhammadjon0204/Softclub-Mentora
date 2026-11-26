import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { getAssignment, getAssignmentHistory, type TaskEvent } from '@/features/assignments/api';
import { relativeDue } from '@/features/assignments/grouping';
import { EVENT_LABEL, isActionable } from '@/features/assignments/status';
import { WEB_URL } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { PrimaryButton, SecondaryButton, StateMessage, StatusPill } from '@/ui/primitives';

export default function AssignmentScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, language, locale } = useT();
  const assignment = useQuery({ queryKey: ['assignment', id], queryFn: () => getAssignment(id) });
  const history = useQuery({ queryKey: ['assignment', id, 'history'], queryFn: () => getAssignmentHistory(id) });

  if (assignment.isPending) return <StateMessage loading title={t('Загружаем задание…')} />;
  if (assignment.isError) {
    return (
      <StateMessage
        title={t('Не удалось открыть задание')}
        detail={t(assignment.error.message)}
        action={<SecondaryButton label={t('Повторить')} onPress={() => void assignment.refetch()} />}
      />
    );
  }

  const a = assignment.data;
  const due = new Date(a.currentDueAt);
  const relative = relativeDue(a.currentDueAt, language);
  const actionable = isActionable(a.status);
  const moved = a.currentDueAt !== a.initialDueAt;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container}>
      <View style={{ gap: Space.sm }}>
        <StatusPill status={a.status} />
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{a.title}</Text>
        {a.branch ? <Text style={{ color: c.textMuted, fontSize: 14 }}>{a.branch.name}</Text> : null}
      </View>

      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: relative.overdue && actionable ? c.danger : c.border }]}>
        <Text style={[styles.panelLabel, { color: c.textMuted }]}>{t('Срок сдачи')}</Text>
        <Text style={[styles.dueDate, { color: c.text }]}>
          {due.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })},{' '}
          {due.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {actionable ? (
          <Text style={{ color: relative.overdue ? c.danger : c.textSecondary, fontSize: 14 }}>{relative.text}</Text>
        ) : null}
        {moved ? (
          <Text style={{ color: c.textMuted, fontSize: 13 }}>
            {t('Срок изменён')} · {t('был')} {new Date(a.initialDueAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
          </Text>
        ) : null}
      </View>

      {a.description ? (
        <View style={{ gap: Space.sm }}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('Описание')}</Text>
          <Text style={[styles.body, { color: c.text }]} selectable>{a.description}</Text>
        </View>
      ) : null}

      {a.status === 'Cancelled' && a.cancelReason ? (
        <Text style={[styles.body, { color: c.textSecondary }]}>{t('Причина отмены')}: {a.cancelReason}</Text>
      ) : null}

      {actionable ? (
        <View style={{ gap: Space.sm }}>
          {/* Uploading files from the phone is the next stage; until then the site does it. */}
          <PrimaryButton
            label={t('Сдать работу на сайте')}
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/mentor/tasks?assignmentId=${encodeURIComponent(a.id)}`)}
          />
          <Text style={{ color: c.textMuted, fontSize: 13, textAlign: 'center' }}>
            {t('Загрузка файлов прямо из приложения появится в следующей версии.')}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: Space.sm }}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('История')}</Text>
        {history.isPending ? <Text style={{ color: c.textMuted }}>{t('Загрузка…')}</Text> : null}
        {history.isError ? <Text style={{ color: c.danger }}>{t('Не удалось загрузить историю')}</Text> : null}
        {history.data?.length === 0 ? <Text style={{ color: c.textMuted }}>{t('Событий пока нет')}</Text> : null}
        {history.data
          ?.slice()
          .reverse()
          .map((event, index, all) => <HistoryItem key={event.id} event={event} last={index === all.length - 1} />)}
      </View>
    </ScrollView>
  );
}

function HistoryItem({ event, last }: { event: TaskEvent; last: boolean }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const when = new Date(event.occurredAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.event}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: c.brand }]} />
        {!last ? <View style={[styles.line, { backgroundColor: c.border }]} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : Space.lg, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}>{t(EVENT_LABEL[event.eventType] ?? event.eventType)}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          {when}
          {event.actorLabel ? ` · ${t(event.actorLabel)}` : ''}
        </Text>
        {event.reason ? <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 20 }}>{event.reason}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Space.lg, gap: Space.xl, paddingBottom: Space.xxl * 2 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  panel: { borderWidth: 1, borderRadius: Radius.lg, padding: Space.lg, gap: Space.xs },
  panelLabel: { fontSize: 13, fontWeight: '500' },
  dueDate: { fontSize: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  event: { flexDirection: 'row', gap: Space.md },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  line: { width: 2, flex: 1, marginTop: 4 },
});

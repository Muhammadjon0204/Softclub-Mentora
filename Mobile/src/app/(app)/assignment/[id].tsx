import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { getAssignment, getAssignmentHistory, listSubmissions, type TaskEvent } from '@/features/assignments/api';
import { relativeDue } from '@/features/assignments/grouping';
import { useCan, usePeopleNames } from '@/features/assignments/queries';
import { AssignmentActions } from '@/features/assignments/AssignmentActions';
import { ReviewPanel } from '@/features/assignments/ReviewPanel';
import { SubmitPanel } from '@/features/assignments/SubmitPanel';
import { EVENT_LABEL, isActionable } from '@/features/assignments/status';
import { Submissions } from '@/features/assignments/Submissions';
import { useT } from '@/lib/i18n';
import { useAccount, useSession, useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Button, Card } from '@/ui/kit';
import { SecondaryButton, StateMessage, StatusPill } from '@/ui/primitives';

export default function AssignmentScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, language, locale } = useT();
  const headerHeight = useHeaderHeight();
  const assignment = useQuery({ queryKey: ['assignment', id], queryFn: () => getAssignment(id) });
  const history = useQuery({ queryKey: ['assignment', id, 'history'], queryFn: () => getAssignmentHistory(id) });
  const submissions = useQuery({ queryKey: ['assignment', id, 'submissions'], queryFn: () => listSubmissions(id) });
  const user = useUser();
  const can = useCan();
  const nameOf = usePeopleNames();

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
  const isExecutor = a.assignedToId === user.id;
  // An administrator hands work in from their place in the team, not from the administrator's one.
  const outsideTeam = isExecutor && user.role === 'Admin';
  const actionable = isExecutor && !outsideTeam && isActionable(a.status);
  const awaiting = a.status === 'Submitted' || a.status === 'InReview';
  const versions = submissions.data ?? [];
  const latest = versions.reduce<(typeof versions)[number] | null>((best, s) => (!best || s.versionNumber > best.versionNumber ? s : best), null);
  const mayReview = awaiting && a.canManage === true && can('assignments.review') && !isExecutor;
  const assigneeName = isExecutor ? null : nameOf(a.assignedToId);
  const moved = a.currentDueAt !== a.initialDueAt;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior="padding" keyboardVerticalOffset={headerHeight}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={{ gap: Space.sm }}>
        <StatusPill status={a.status} />
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{a.title}</Text>
        {assigneeName ? (
          <Text style={{ color: c.textSecondary, fontSize: 15 }}>
            {t('Исполнитель')}: {assigneeName}
          </Text>
        ) : null}
        {a.branch ? <Text style={{ color: c.textMuted, fontSize: 14 }}>{a.branch.name}</Text> : null}
      </View>

      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: relative.overdue && isActionable(a.status) ? c.danger : c.border }]}>
        <Text style={[styles.panelLabel, { color: c.textMuted }]}>{t('Срок сдачи')}</Text>
        <Text style={[styles.dueDate, { color: c.text }]}>
          {due.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })},{' '}
          {due.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {isActionable(a.status) ? (
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

      {actionable ? <SubmitPanel assignmentId={a.id} /> : null}
      {outsideTeam && isActionable(a.status) ? <SwitchToTeam categoryId={a.categoryId} assignmentId={a.id} /> : null}

      {versions.length > 0 ? (
        <View style={{ gap: Space.sm }}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('Сданные работы')}</Text>
          <Submissions items={versions} />
        </View>
      ) : null}
      {submissions.isError ? <Text style={{ color: c.danger }}>{t('Не удалось загрузить сданные работы')}</Text> : null}

      {mayReview && latest ? <ReviewPanel assignment={a} submissionId={latest.id} /> : null}
      {!isExecutor ? <AssignmentActions assignment={a} /> : null}
      {awaiting && !isExecutor && a.canManage !== true ? (
        <Text style={{ color: c.textMuted, fontSize: 14 }}>{t('Проверяет тот, кто выдал задание.')}</Text>
      ) : null}

      <View style={{ gap: Space.sm }}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('История')}</Text>
        {history.isPending ? <Text style={{ color: c.textMuted }}>{t('Загрузка…')}</Text> : null}
        {history.isError ? <Text style={{ color: c.danger }}>{t('Не удалось загрузить историю')}</Text> : null}
        {history.data?.length === 0 ? <Text style={{ color: c.textMuted }}>{t('Событий пока нет')}</Text> : null}
        {history.data
          ?.slice()
          .reverse()
          .map((event, index, all) => (
            <HistoryItem key={event.id} event={event} actor={
                // The server calls every non-admin «Lead», the mentor's own hand-ins included.
                isExecutor && event.actorLabel && event.eventType.endsWith('SubmissionUploaded')
                  ? t('Вы')
                  : event.actorLabel
                    ? t(ACTOR_ROLE[event.actorLabel] ?? event.actorLabel)
                    : nameOf(event.actorId)
              } last={index === all.length - 1} />
          ))}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The way into the team a task belongs to, for whoever is looking at it from outside. */
function SwitchToTeam({ categoryId, assignmentId }: { categoryId: string; assignmentId: string }): JSX.Element | null {
  const { t } = useT();
  const c = useColors();
  const account = useAccount();
  const { switchTeam } = useSession();
  const team = account.teams?.find((candidate) => candidate.categoryId === categoryId);
  if (!team) return null;
  return (
    <Card style={{ gap: Space.md }}>
      <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>
        {t('Это ваше задание. Чтобы сдать работу, перейдите в команду')} «{team.name}».
      </Text>
      <Button
        label={t('Перейти в команду')}
        onPress={() => switchTeam(categoryId, { pathname: '/assignment/[id]', params: { id: assignmentId } })}
      />
    </Card>
  );
}

/** A mentor sees the role of whoever acted, as the server names it. */
const ACTOR_ROLE: Record<string, string> = { Lead: 'Тимлид', Admin: 'Администратор' };

function HistoryItem({ event, actor, last }: { event: TaskEvent; actor: string | null; last: boolean }): JSX.Element {
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
          {actor ? ` · ${actor}` : ''}
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

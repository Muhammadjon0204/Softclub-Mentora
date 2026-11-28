import { router } from 'expo-router';
import { AlarmClock, CheckCircle2, ClipboardCheck, ClipboardList, Wrench } from 'lucide-react-native';
import { View } from 'react-native';

import { Space } from '@/constants/theme';
import type { Assignment } from '@/features/assignments/api';
import { relativeDue } from '@/features/assignments/grouping';
import { awaitingMyReview, useAssignments, usePeopleNames } from '@/features/assignments/queries';
import { isActionable, STATUS_LABEL, STATUS_TONE } from '@/features/assignments/status';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { Avatar, Badge, Group, Row, Section, Stats } from '@/ui/kit';
import { Loaded } from '@/ui/page';

const MONTH = 30 * 24 * 60 * 60 * 1000;

/**
 * The overview of a lead (their team) and of a mentor (their own work), counted from the assignments
 * the server lets them see: what needs action now, then what is coming.
 */
export function TeamOverview(): JSX.Element {
  const query = useAssignments();
  const nameOf = usePeopleNames();
  const { t, language, locale } = useT();
  const user = useUser();
  const lead = user.role === 'Lead';

  return (
    <Loaded query={query}>
      {(all) => {
        const team = lead ? all.filter((a) => a.assignedToId !== user.id) : all;
        const mine = all.filter((a) => a.assignedToId === user.id);
        const open = team.filter((a) => isActionable(a.status));
        const overdue = open.filter((a) => a.status === 'Overdue' || Date.parse(a.currentDueAt) < Date.now());
        const waiting = awaitingMyReview(all);
        const rework = team.filter((a) => a.status === 'NeedsRework');
        // «Accepted lately» is relative to when the list was loaded, not to each render.
        const loadedAt = query.dataUpdatedAt;
        const approved = team.filter((a) => a.status === 'Approved' && a.approvedAt && loadedAt - Date.parse(a.approvedAt) < MONTH);
        const upcoming = [...open].filter((a) => !overdue.includes(a)).sort((x, y) => Date.parse(x.currentDueAt) - Date.parse(y.currentDueAt)).slice(0, 5);
        const myOpen = lead ? mine.filter((a) => isActionable(a.status)) : [];
        const members = lead ? [...new Set(team.map((a) => a.assignedToId))] : [];
        const row = (a: Assignment) => (
          <Row
            key={a.id}
            title={a.title}
            subtitle={[lead ? nameOf(a.assignedToId) : null, new Date(a.currentDueAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }), isActionable(a.status) ? relativeDue(a.currentDueAt, language).text : null].filter(Boolean).join(' · ')}
            meta={a.status !== 'Assigned' ? <Badge tone={STATUS_TONE[a.status]} label={t(STATUS_LABEL[a.status])} /> : undefined}
            onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: a.id } })}
          />
        );
        // Returned work is the mentor's own next step; for a lead it is the team member's.
        const urgent = [...waiting, ...overdue, ...(lead ? [] : rework)];
        const attention = [...new Set(urgent)].slice(0, 6);

        return (
          <View style={{ gap: Space.xl }}>
            <Stats
              items={[
                ...(lead ? [{ label: t('Ждут моей проверки'), value: waiting.length, tone: 'brand' as const, icon: ClipboardCheck, onPress: () => router.push('/review') }] : []),
                { label: t('В работе'), value: open.length, icon: ClipboardList, onPress: () => router.push('/assignments') },
                { label: t('Просрочено'), value: overdue.length, tone: 'danger', icon: AlarmClock, onPress: () => router.push({ pathname: '/assignments', params: { filter: 'overdue', at: String(Date.now()) } }) },
                { label: t('На доработке'), value: rework.length, tone: 'warning', icon: Wrench, onPress: () => router.push({ pathname: '/assignments', params: { filter: 'rework', at: String(Date.now()) } }) },
                { label: t('Принято за 30 дней'), value: approved.length, tone: 'success', icon: CheckCircle2, onPress: () => router.push({ pathname: '/assignments', params: { filter: 'done', at: String(Date.now()) } }) },
              ]}
            />

            <Section title={t('Требуют внимания')}>
              <Group>{attention.length === 0 ? <Row title={t('Всё в порядке')} subtitle={t(lead ? 'Просроченных и ждущих проверки работ нет.' : 'Просроченных и возвращённых на доработку работ нет.')} /> : attention.map(row)}</Group>
            </Section>

            <Section title={t('Ближайшие сроки')} action={t('Календарь')} onAction={() => router.push('/calendar')}>
              <Group>{upcoming.length === 0 ? <Row title={t('Ближайших сроков нет')} /> : upcoming.map(row)}</Group>
            </Section>

            {myOpen.length > 0 ? (
              <Section title={t('Мои задания')}>
                <Group>{myOpen.map(row)}</Group>
              </Section>
            ) : null}

            {members.length > 0 ? (
              <Section title={t('Команда')} action={t('Все')} onAction={() => router.push('/users')}>
                <Group>
                  {members.map((id) => {
                    const tasks = team.filter((a) => a.assignedToId === id);
                    const inWork = tasks.filter((a) => isActionable(a.status)).length;
                    const late = tasks.filter((a) => a.status === 'Overdue').length;
                    const name = nameOf(id) ?? '…';
                    return (
                      <Row
                        key={id}
                        title={name}
                        subtitle={`${t('В работе')}: ${inWork}${late ? ` · ${t('Просрочено')}: ${late}` : ''}`}
                        leading={<Avatar name={name} size={36} />}
                        onPress={() => router.push({ pathname: '/users/[id]', params: { id } })}
                      />
                    );
                  })}
                </Group>
              </Section>
            ) : null}
          </View>
        );
      }}
    </Loaded>
  );
}

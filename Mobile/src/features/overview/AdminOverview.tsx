import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Activity, AlarmClock, ClipboardCheck, ClipboardList, GraduationCap, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { getDashboard, type DashboardPeriod } from '@/api/admin';
import { Space } from '@/constants/theme';
import { awaitingMyReview, useAssignments } from '@/features/assignments/queries';
import { STATUS_LABEL, STATUS_TONE } from '@/features/assignments/status';
import type { AssignmentStatus } from '@/features/assignments/api';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Avatar, Badge, Card, Chips, Group, Progress, Row, Section, Stats, healthTone } from '@/ui/kit';
import { Loaded } from '@/ui/page';

import { ActivityChart } from './ActivityChart';

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: '1m', label: 'Месяц' },
  { value: '3m', label: '3 месяца' },
  { value: '6m', label: '6 месяцев' },
  { value: '1y', label: 'Год' },
  { value: 'all', label: 'Всё время' },
];

/** The same numbers as the site's «Обзор», ordered by what needs a decision first. */
export function AdminOverview(): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const user = useUser();
  const [period, setPeriod] = useState<DashboardPeriod>('1m');
  const query = useQuery({ queryKey: ['dashboard', user.id, period], queryFn: () => getDashboard(period) });
  const assignments = useAssignments();
  const waiting = awaitingMyReview(assignments.data ?? []).length;
  const overdue = (assignments.data ?? []).filter((a) => a.status === 'Overdue').length;
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const delta = (pct: number) => (pct === 0 ? undefined : `${pct > 0 ? '+' : ''}${Math.round(pct)}% ${t('к прошлому периоду')}`);

  return (
    <View style={{ gap: Space.lg }}>
      <Chips value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: t(p.label) }))} />
      <Loaded query={query}>
        {(d) => (
          <View style={{ gap: Space.xl }}>
            <Stats
              items={[
                { label: t('Ждут моей проверки'), value: waiting, tone: 'brand', icon: ClipboardCheck, onPress: () => router.push('/review') },
                { label: t('Просрочено'), value: overdue, tone: 'danger', icon: AlarmClock, onPress: () => router.push({ pathname: '/assignments', params: { filter: 'overdue', at: String(Date.now()) } }) },
                { label: t('Активные задания'), value: d.kpis.activeAssignments, icon: ClipboardList, hint: delta(d.kpis.activeAssignmentsDeltaPct), onPress: () => router.push('/assignments') },
                { label: t('Ожидают проверки'), value: d.kpis.pendingReview, icon: Activity, hint: delta(d.kpis.pendingReviewDeltaPct), onPress: () => router.push({ pathname: '/assignments', params: { filter: 'review', at: String(Date.now()) } }) },
                { label: t('Всего пользователей'), value: d.kpis.totalUsers, icon: Users, hint: delta(d.kpis.totalUsersDeltaPct), onPress: () => router.push('/users') },
                { label: t('Активные менторы'), value: d.kpis.activeMentors, icon: GraduationCap, hint: delta(d.kpis.activeMentorsDeltaPct), onPress: () => router.push('/users') },
              ]}
            />

            <Section title={t('Активность заданий')}>
              <Card>
                <ActivityChart points={d.activitySeries.map((p) => ({ label: p.dateLabel, submitted: p.submitted, approved: p.approved, overdue: p.overdue }))} />
              </Card>
            </Section>

            <Section title={t('Ближайшие сроки')} action={t('Календарь')} onAction={() => router.push('/calendar')}>
              <Group>
                {d.upcomingDeadlines.length === 0 ? <Row title={t('Ближайших сроков нет')} /> : null}
                {d.upcomingDeadlines.slice(0, 5).map((item) => (
                  <Row key={item.id} title={item.title} subtitle={`${item.mentorName} · ${date(item.dueAt)}`} onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: item.id } })} />
                ))}
              </Group>
            </Section>

            {d.branchHealth && d.branchHealth.length > 1 ? (
              <Section title={t('Филиалы')} action={t('Все')} onAction={() => router.push('/branches')}>
                <Group>
                  {d.branchHealth.map((b) => (
                    <Row
                      key={b.branchId}
                      title={b.branchName}
                      subtitle={`${t('Менторы')}: ${b.mentorsCount} · ${t('Активные задания')}: ${b.activeAssignments}`}
                      meta={<Progress percent={b.healthPct} tone={healthTone(b.healthPct)} />}
                      trailing={<Text style={{ color: c.text, fontWeight: '700' }}>{b.healthPct}%</Text>}
                    />
                  ))}
                </Group>
              </Section>
            ) : null}

            <Section title={t('Направления')} action={t('Все')} onAction={() => router.push('/categories')}>
              <Group>
                {d.categoryHealth.length === 0 ? <Row title={t('Направлений пока нет')} /> : null}
                {d.categoryHealth.map((cat) => (
                  <Row
                    key={cat.categoryId}
                    title={cat.categoryName}
                    subtitle={`${cat.leadName ?? t('Без руководителя')} · ${t('Менторы')}: ${cat.mentorsCount} · ${t('В срок')}: ${cat.onTimeRatePct}%`}
                    meta={<Progress percent={cat.healthPct} tone={healthTone(cat.healthPct)} />}
                    trailing={<Text style={{ color: c.text, fontWeight: '700' }}>{cat.healthPct}%</Text>}
                    onPress={() => router.push({ pathname: '/categories/[id]', params: { id: cat.categoryId } })}
                  />
                ))}
              </Group>
            </Section>

            {d.topMentors.length > 0 ? (
              <Section title={t('Лучшие менторы')}>
                <Group>
                  {d.topMentors.slice(0, 5).map((m) => (
                    <Row
                      key={m.mentorId}
                      title={m.mentorName}
                      subtitle={m.categoryName}
                      leading={<Avatar name={m.mentorName} size={36} />}
                      trailing={<Badge tone="success" label={`${t('Принято')}: ${m.approved}`} />}
                      onPress={() => router.push({ pathname: '/users/[id]', params: { id: m.mentorId } })}
                    />
                  ))}
                </Group>
              </Section>
            ) : null}

            <Section title={t('Последняя активность')} action={t('Журнал')} onAction={() => router.push('/journal')}>
              <Group>
                {d.recentAssignmentActivity.length === 0 ? <Row title={t('Записей пока нет')} /> : null}
                {d.recentAssignmentActivity.slice(0, 6).map((a) => (
                  <Row
                    key={`${a.id}-${a.at}`}
                    title={a.title}
                    subtitle={`${a.mentorName} · ${a.categoryName} · ${date(a.at)}`}
                    meta={<Badge tone={STATUS_TONE[a.status as AssignmentStatus] ?? 'neutral'} label={t(STATUS_LABEL[a.status as AssignmentStatus] ?? a.status)} />}
                    onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: a.id } })}
                  />
                ))}
              </Group>
            </Section>
          </View>
        )}
      </Loaded>
    </View>
  );
}

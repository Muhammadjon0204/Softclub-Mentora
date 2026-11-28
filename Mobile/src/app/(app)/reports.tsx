import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { aiSummary, getReport, type Duration, type Metrics } from '@/api/work';
import { Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { dayKey } from '@/ui/date';
import { useAction } from '@/ui/feedback';
import { Avatar, Button, Card, Chips, Group, Info, Progress, Row, Section, Stats } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Segmented } from '@/ui/Screen';

type Period = '30' | '90' | '365' | 'all';

export default function ReportsScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const me = useUser();
  const orgAdmin = me.adminScope === 'Organization';
  const [period, setPeriod] = useState<Period>('90');
  const [view, setView] = useState<'main' | 'branches'>('main');
  const [today] = useState(() => new Date());
  const from = period === 'all' ? null : dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - Number(period)));
  const to = period === 'all' ? null : dayKey(today);
  const kind = me.role === 'Mentor' ? 'personal' : view === 'branches' ? 'branches' : 'team';
  const query = useQuery({ queryKey: ['report', me.id, kind, from, to], queryFn: () => getReport(kind, from, to) });
  const [summary, setSummary] = useState<{ content: string; disclaimer: string } | null>(null);
  const scope = me.role === 'Mentor' ? 'Personal' : me.role === 'Lead' ? 'Team' : orgAdmin ? 'Organization' : 'Branch';
  const generate = useAction(async () => setSummary(await aiSummary(scope, from, to)));

  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      {orgAdmin ? (
        <Segmented value={view} onChange={setView} options={[{ value: 'main', label: t('Организация') }, { value: 'branches', label: t('По филиалам') }]} />
      ) : null}
      <Chips
        value={period}
        onChange={(next) => {
          setPeriod(next);
          setSummary(null);
        }}
        options={[
          { value: '30', label: t('Месяц') },
          { value: '90', label: t('3 месяца') },
          { value: '365', label: t('Год') },
          { value: 'all', label: t('Всё время') },
        ]}
      />
      <Loaded query={query}>
        {(report) => (
          <View style={{ gap: Space.xl }}>
            <Totals metrics={report.total} />
            {report.rows.length > 0 ? (
              <Section title={t(report.rows.some((r) => r.mentorFullName) ? 'По людям' : report.rows.some((r) => r.categoryName) ? 'По направлениям' : 'По филиалам')}>
                <Group>
                  {report.rows.map((row, i) => {
                    const name = row.mentorFullName ?? row.categoryName ?? row.branch?.name ?? '—';
                    const m = row.metrics;
                    const done = m.totalAssignments ? Math.round((m.approvedAssignments / m.totalAssignments) * 100) : 0;
                    return (
                      <Row
                        key={`${name}-${i}`}
                        title={name}
                        subtitle={`${t('Принято')}: ${m.approvedAssignments} ${t('из')} ${m.totalAssignments}${m.overdueRate != null ? ` · ${t('Просрочено')}: ${m.overdueRate}%` : ''}${row.categoryName && row.mentorFullName ? ` · ${row.categoryName}` : ''}`}
                        leading={row.mentorFullName ? <Avatar name={name} size={36} /> : undefined}
                        meta={<Progress percent={done} tone="success" />}
                        trailing={<Text style={{ color: c.text, fontWeight: '700' }}>{done}%</Text>}
                        onPress={row.mentorId ? () => router.push({ pathname: '/users/[id]', params: { id: row.mentorId as string } }) : undefined}
                      />
                    );
                  })}
                </Group>
              </Section>
            ) : null}
            <Section title={t('AI-резюме')}>
              {summary ? (
                <Card>
                  <Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }} selectable>{summary.content}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>{summary.disclaimer}</Text>
                </Card>
              ) : (
                <Button kind="secondary" icon={Sparkles} label={t('Составить краткий разбор')} loading={generate.busy} onPress={() => generate.run()} />
              )}
            </Section>
          </View>
        )}
      </Loaded>
    </Page>
  );
}

function Totals({ metrics: m }: { metrics: Metrics }): JSX.Element {
  const { t } = useT();
  const percent = (value: number | null | undefined) => (value == null ? '—' : `${value}%`);
  const hours = (d: Duration) => (d.medianHours == null ? '—' : d.medianHours >= 48 ? `${Math.round((d.medianHours / 24) * 10) / 10} ${t('дн.')}` : `${d.medianHours} ${t('ч')}`);
  return (
    <>
      <Stats
        items={[
          { label: t('Всего заданий'), value: m.totalAssignments },
          { label: t('Принято'), value: m.approvedAssignments, tone: 'success' },
          { label: t('Принято с первого раза'), value: percent(m.firstPassApprovalRate) },
          { label: t('Доля просроченных'), value: percent(m.overdueRate), tone: (m.overdueRate ?? 0) > 0 ? 'danger' : 'neutral' },
        ]}
      />
      <Section title={t('Сроки (обычное значение)')}>
        <Group>
          <Info label={t('До первой сдачи')} value={hours(m.initialSubmissionTime)} />
          <Info label={t('Ответ на проверку')} value={hours(m.firstReviewResponseTime)} />
          <Info label={t('Весь путь задания')} value={hours(m.totalCycleTime)} />
          <Info label={t('Версий на задание')} value={m.averageVersions == null ? '—' : String(m.averageVersions)} />
          <Info label={t('Сдано с опозданием')} value={percent(m.lateSubmissionRate)} />
        </Group>
      </Section>
    </>
  );
}

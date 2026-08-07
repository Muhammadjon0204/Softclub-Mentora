import { CalendarDays, Download, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSearchParams } from 'react-router-dom';

import { ExportReportModal } from '../../features/admin-reports/ExportReportModal';
import { MetricDetailsDrawer } from '../../features/admin-reports/MetricDetailsDrawer';
import type { MetricKey } from '../../features/admin-reports/reportPresentation';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { BRANCH_DIRECTORY } from '../../features/admin-preview/branchDirectory';
import {
  PREVIEW_AI_SUMMARY,
  PREVIEW_BRANCH_COMPARISON,
  PREVIEW_CATEGORY_RESULTS,
  PREVIEW_COMPLETION_TREND,
  PREVIEW_MENTOR_LOAD,
  PREVIEW_REPORT_KPIS,
  PREVIEW_REPORT_PERIOD_LABEL,
} from '../../mocks/ui-preview/reports.preview';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { ChartCard } from '../../shared/ui/ChartCard';

const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  ...BRANCH_DIRECTORY.map((branch) => ({ value: branch.rawName, label: branch.displayName })),
];
/** Branch Admin не видит «Лучший филиал» / сравнение — это Organization Admin domain (TZ 21.6). */
const BRANCH_ADMIN_AI_SUMMARY_TEXT =
  'На этой неделе общий процент завершения заданий вашего филиала увеличился на 12% по сравнению с предыдущей неделей и составил 78%. Доля просроченных заданий снизилась до 8.6%, что является хорошим показателем. Категория «UI/UX Design» требует внимания — там нет назначенного Lead и заметно выше доля просрочек. Рекомендуется в первую очередь назначить руководителя направления для UI/UX Design.';
const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Все категории' },
  { value: 'C#', label: 'C#' },
  { value: 'Frontend', label: 'Frontend' },
  { value: 'Python', label: 'Python' },
  { value: 'UI/UX Design', label: 'UI/UX Design' },
];

const METRIC_KEYS: MetricKey[] = ['completion', 'overdue', 'firstPass', 'reviewTime'];

/** UI-прототип /admin/reports — этап 3: MetricDetailsDrawer + ExportReportModal поверх shared overlay system. */
export function ReportsPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';

  const [branch, setBranch] = useState('all');
  const [category, setCategory] = useState('all');
  const [exportOpen, setExportOpen] = useState(false);
  const toast = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const metricParam = searchParams.get('metric');
  const metricKey = metricParam !== null && (METRIC_KEYS as string[]).includes(metricParam) ? (metricParam as MetricKey) : null;

  function openMetric(key: MetricKey): void {
    const next = new URLSearchParams(searchParams);
    next.set('metric', key);
    setSearchParams(next);
  }

  function closeMetric(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('metric');
    setSearchParams(next);
  }

  const branchLabel = isOrgAdmin ? (BRANCH_OPTIONS.find((option) => option.value === branch)?.label ?? 'Все филиалы') : (authUser?.branch?.name ?? '—');
  const categoryLabel = CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'Все категории';

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Отчёты"
        subtitle={isOrgAdmin ? 'Аналитика эффективности филиалов и направлений' : 'Аналитика эффективности направлений филиала'}
        action={
          <>
            <span className="hidden h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] text-ink-secondary sm:flex">
              <CalendarDays className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              {PREVIEW_REPORT_PERIOD_LABEL}
            </span>
            <Button variant="secondary" leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />} onClick={() => { setExportOpen(true); }}>
              Экспортировать
            </Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-center gap-2.5">
        {isOrgAdmin ? <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} /> : null}
        <PreviewSelect label="Категория" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PREVIEW_REPORT_KPIS.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            onClick={() => { openMetric(kpi.key as MetricKey); }}
            className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5 text-left shadow-surface transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-6"
          >
            <p className="text-[13px] text-ink-muted">{kpi.label}</p>
            <p className="text-[26px] font-bold leading-8 tracking-tight text-ink tabular-nums">{kpi.value}</p>
            <span
              className={`inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[12px] font-semibold ${
                kpi.deltaTone === 'positive' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              }`}
            >
              {kpi.deltaPct > 0 ? '+' : ''}
              {kpi.deltaPct}% за неделю
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Динамика завершения" description="Процент завершения заданий по дням">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={PREVIEW_COMPLETION_TREND} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--divider)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={36} unit="%" />
              <RechartsTooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(16,24,40,0.08)', fontSize: 13 }} />
              <Line type="monotone" dataKey="value" name="Завершение" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {isOrgAdmin ? (
          <ChartCard title="Сравнение филиалов" description="Процент завершения заданий по филиалам">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={PREVIEW_BRANCH_COMPARISON} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--divider)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="branchName" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
                <RechartsTooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(16,24,40,0.08)', fontSize: 13 }} />
                <Bar dataKey="completionPct" name="Завершение" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        <ChartCard title="Результаты категорий" description="Завершение и просрочки по направлениям">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={PREVIEW_CATEGORY_RESULTS} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--divider)" vertical={false} />
              <XAxis dataKey="categoryName" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0} angle={-12} textAnchor="end" height={40} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={36} unit="%" />
              <RechartsTooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(16,24,40,0.08)', fontSize: 13 }} />
              <Bar dataKey="completionPct" name="Завершение" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="overduePct" name="Просрочки" fill="var(--warning)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Нагрузка менторов" description="Активные задания на ментора">
          <ul className="space-y-3 px-1 py-1">
            {PREVIEW_MENTOR_LOAD.map((entry) => {
              const max = PREVIEW_MENTOR_LOAD[0]?.activeAssignments ?? 1;
              const pct = Math.round((entry.activeAssignments / max) * 100);
              return (
                <li key={entry.mentorName}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="text-ink-secondary">{entry.mentorName}</span>
                    <span className="font-semibold tabular-nums text-ink">{entry.activeAssignments}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-[var(--secondary-blue)]" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartCard>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-soft text-brand">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-semibold text-ink">AI-резюме</h2>
          </div>
          <Badge tone="info">{PREVIEW_AI_SUMMARY.generatedLabel}</Badge>
        </div>
        <p className="text-[13.5px] leading-[21px] text-ink-secondary">{isOrgAdmin ? PREVIEW_AI_SUMMARY.text : BRANCH_ADMIN_AI_SUMMARY_TEXT}</p>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              toast.info('AI-провайдер не подключён в preview-режиме');
            }}
          >
            Обновить резюме
          </Button>
        </div>
      </Card>

      <MetricDetailsDrawer metricKey={metricKey} onClose={closeMetric} scopeLabel={`${branchLabel} · ${categoryLabel}`} />
      <ExportReportModal open={exportOpen} onOpenChange={setExportOpen} branchLabel={branchLabel} categoryLabel={categoryLabel} showBranchComparison={isOrgAdmin} />
    </div>
  );
}

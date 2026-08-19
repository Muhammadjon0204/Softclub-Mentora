import { CheckCircle2, ClipboardList, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { LeadActivityChart } from '../../features/lead-dashboard/LeadActivityChart';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { useMentorReports } from '../../features/mentor-reports/useMentorReports';
import type { ReportsFilters } from '../../features/mentor-reports/useMentorReports';
import { useMentorScope } from '../../features/mentor/scope/useMentorScope';
import { Card } from '../../shared/ui/Card';
import { FormCheckbox } from '../../shared/ui/FormField';

const PERIOD_OPTIONS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: 'all', label: 'Всё время' },
];

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function formatHoursMetric(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 24) return `${hours.toFixed(1)} ч`;
  return `${(hours / 24).toFixed(1)} дн.`;
}

/**
 * `/mentor/reports` (ТЗ 2.2, раздел 24.5 — `GET /reports/personal`) —
 * только собственные метрики (раздел 21.5: «Mentor видит только собственные
 * метрики»), без разбивки по другим менторам и без фильтра по конкретному
 * ментору (`ANA-013` — недоступен для роли Mentor).
 */
export function ReportsPage(): JSX.Element {
  const scope = useMentorScope();
  const [periodDays, setPeriodDays] = useState('30');
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const filters: ReportsFilters = { periodDays: periodDays === 'all' ? 'all' : Number(periodDays), includeCancelled };
  const report = useMentorReports(filters);

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Отчёты" subtitle={`${scope.categoryName} · ${scope.branchDisplayName} — личная аналитика`} />

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
          <PreviewSelect label="Период" value={periodDays} onChange={setPeriodDays} options={PERIOD_OPTIONS} className="w-[140px]" />
          <div className="h-6 w-px shrink-0 bg-divider" aria-hidden="true" />
          <FormCheckbox label="Учитывать отменённые" checked={includeCancelled} onChange={(event) => { setIncludeCancelled(event.target.checked); }} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} label="Назначено за период" value={String(report.totalAssignments)} />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} label="Принято" value={String(report.approvedAssignments)} />
        <PreviewMetricCard icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label="С первой попытки" value={formatPercent(report.firstPassApprovalRate)} />
        <PreviewMetricCard icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />} label="Доля просрочек" value={formatPercent(report.overdueRate)} tone={report.overdueRate !== null && report.overdueRate > 0 ? 'warning' : 'default'} />
      </div>

      <Card padded={false}>
        <div className="border-b border-divider px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold text-ink">Активность за 14 дней</h2>
        </div>
        <div className="p-4 sm:p-5">
          <LeadActivityChart data={report.activity} />
        </div>
      </Card>

      <Card padded={false}>
        <div className="border-b border-divider px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold text-ink">Длительности цикла</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Медиана — основное значение, среднее — рядом справочно</p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-divider sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          {([
            ['До первой отправки', report.initialSubmissionTime],
            ['Ожидание проверки', report.firstReviewResponseTime],
            ['Финальная проверка', report.finalReviewTime],
            ['Полный цикл', report.totalCycleTime],
          ] as const).map(([label, metric]) => (
            <div key={label} className="p-5">
              <p className="text-[12px] text-ink-muted">{label}</p>
              <p className="mt-1.5 text-[22px] font-bold leading-7 tabular-nums text-ink">{formatHoursMetric(metric.medianHours)}</p>
              <p className="mt-1 text-[11.5px] text-ink-muted">среднее: {formatHoursMetric(metric.averageHours)}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 divide-y divide-divider border-t border-divider sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
          <div className="flex items-center justify-between px-5 py-3.5 text-[13px] sm:px-6">
            <span className="text-ink-muted">Среднее число версий на задание</span>
            <span className="font-semibold tabular-nums text-ink">{report.averageVersions === null ? '—' : report.averageVersions.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5 text-[13px] sm:px-6">
            <span className="text-ink-muted">Доля сдач с опозданием</span>
            <span className={`font-semibold tabular-nums ${report.lateSubmissionRate !== null && report.lateSubmissionRate > 0 ? 'text-warning' : 'text-ink'}`}>
              {formatPercent(report.lateSubmissionRate)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

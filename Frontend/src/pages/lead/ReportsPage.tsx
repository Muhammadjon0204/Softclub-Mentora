import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { useLeadReports } from '../../features/lead-reports/useLeadReports';
import type { ReportsFilters } from '../../features/lead-reports/useLeadReports';
import { scopedActiveMentors } from '../../features/lead/scope/leadScopedData';
import { useLeadScope } from '../../features/lead/scope/useLeadScope';
import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
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

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/**
 * `/lead/reports` (ТЗ 2.2, раздел 21 — формулы метрик; раздел 24.4 — маршрут).
 * Фильтры ограничены доступным Lead набором (`ANA-010`/`TEN-070`): период,
 * ментор, включение отменённых. Branch/Category фильтров нет — они фиксированы.
 */
export function ReportsPage(): JSX.Element {
  const scope = useLeadScope();
  const mentors = scopedActiveMentors(scope.categoryId);

  const [periodDays, setPeriodDays] = useState('30');
  const [mentorId, setMentorId] = useState('all');
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);

  const filters: ReportsFilters = { periodDays: periodDays === 'all' ? 'all' : Number(periodDays), mentorId, includeCancelled };
  const report = useLeadReports(filters);

  const mentorOptions = [{ value: 'all', label: 'Все менторы' }, ...mentors.map((m) => ({ value: m.id, label: m.fullName }))];

  const aiSummaryText =
    report.totalAssignments === 0
      ? 'Недостаточно данных за выбранный период для формирования резюме.'
      : `За выбранный период направление «${scope.categoryName}» завершило ${String(report.approvedAssignments)} из ${String(report.totalAssignments)} назначенных заданий` +
        `${report.firstPassApprovalRate !== null ? ` (${formatPercent(report.firstPassApprovalRate)} — с первой попытки)` : ''}. ` +
        `${report.overdueRate !== null && report.overdueRate > 0 ? `Доля просроченных заданий — ${formatPercent(report.overdueRate)}, стоит обратить внимание на распределение нагрузки.` : 'Просроченных заданий за период не зафиксировано.'}`;

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Отчёты"
        subtitle={`${scope.categoryName} · ${scope.branchDisplayName}`}
        action={
          <Button variant="secondary" leadingIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={() => { setAiSummaryOpen(true); }}>
            ИИ-резюме
          </Button>
        }
      />

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
          <PreviewSelect label="Период" value={periodDays} onChange={setPeriodDays} options={PERIOD_OPTIONS} className="w-[140px]" />
          <PreviewSelect label="Ментор" value={mentorId} onChange={setMentorId} options={mentorOptions} className="w-[180px]" />
          <div className="h-6 w-px shrink-0 bg-divider" aria-hidden="true" />
          <FormCheckbox
            label="Учитывать отменённые"
            checked={includeCancelled}
            onChange={(event) => { setIncludeCancelled(event.target.checked); }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label="Назначено за период" value={String(report.totalAssignments)} />
        <PreviewMetricCard icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label="Одобрено" value={String(report.approvedAssignments)} />
        <PreviewMetricCard icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label="С первой попытки" value={formatPercent(report.firstPassApprovalRate)} />
        <PreviewMetricCard icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label="Доля просрочек" value={formatPercent(report.overdueRate)} tone={report.overdueRate !== null && report.overdueRate > 0 ? 'warning' : 'default'} />
      </div>

      <Card padded={false}>
        <div className="border-b border-divider px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold text-ink">Длительности цикла</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Медиана — основное значение (ANA-008), среднее — рядом справочно</p>
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

      <Card padded={false}>
        <div className="border-b border-divider px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold text-ink">По менторам</h2>
        </div>
        {report.mentorBreakdown.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-ink-muted sm:px-6">Нет данных по менторам за период</p>
        ) : (
          <ul className="divide-y divide-divider">
            {report.mentorBreakdown.map((row) => {
              const approvedShare = row.total === 0 ? 0 : Math.round((row.approved / row.total) * 100);
              return (
                <li key={row.mentorId} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                    {initialsOf(row.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{row.fullName}</p>
                    <div className="mt-1.5 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${String(approvedShare)}%` }} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-5 text-[13px] tabular-nums">
                    <div className="w-14 text-right">
                      <p className="font-semibold text-ink">{row.total}</p>
                      <p className="text-[11px] text-ink-muted">задач</p>
                    </div>
                    <div className="w-14 text-right">
                      <p className="font-semibold text-success">{row.approved}</p>
                      <p className="text-[11px] text-ink-muted">одобрено</p>
                    </div>
                    <div className="w-14 text-right">
                      <p className={`font-semibold ${row.overdue > 0 ? 'text-danger' : 'text-ink-disabled'}`}>{row.overdue}</p>
                      <p className="text-[11px] text-ink-muted">просрочено</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={aiSummaryOpen} onOpenChange={setAiSummaryOpen} title="ИИ-резюме направления" size="md" icon={<Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />}>
        <div className="space-y-3">
          <p className="text-[13.5px] leading-[20px] text-ink-secondary">{aiSummaryText}</p>
          <p className="rounded-control-sm border border-line bg-surface-muted px-3 py-2.5 text-[12px] text-ink-muted">
            Preview-режим: реальная генерация ИИ-резюме подключится вместе с backend (раздел 22 ТЗ). Текст выше рассчитан из тех же значений, что показаны на странице.
          </p>
        </div>
      </Modal>
    </div>
  );
}

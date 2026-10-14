import { CheckCircle2, ClipboardList, Download, FileSpreadsheet, FileText, Timer, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { AssignmentDto } from '../../api/lead/assignments';
import { computeAssignmentStats, formatHours, useAssignmentStats } from '../../features/admin-assignments/useAssignmentStats';
import type { AssignmentStats } from '../../features/admin-assignments/useAssignmentStats';
import { DashboardPeriodSelect } from '../../features/admin-dashboard/DashboardPeriodSelect';
import { DASHBOARD_PERIOD_LABEL } from '../../features/admin-dashboard/dashboardPeriod';
import type { DashboardPeriod } from '../../features/admin-dashboard/dashboardPeriod';
import { useDashboardQuery } from '../../features/admin-dashboard/useDashboardQuery';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { ActionMenu } from '../../shared/overlays';
import { Avatar } from '../../shared/ui/Avatar';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonRow } from '../../shared/ui/Skeleton';

const PERIOD_DAYS: Record<DashboardPeriod, number | null> = { all: null, '1m': 30, '3m': 90, '6m': 182, '1y': 365 };

interface ReportRow {
  key: string;
  category: string;
  branch: string;
  lead: string | null;
  mentors: number;
  stats: AssignmentStats;
}

/** Задание попадает в период по дате назначения (или создания, если ещё не назначено). */
function inPeriod(item: AssignmentDto, period: DashboardPeriod, now: number): boolean {
  const days = PERIOD_DAYS[period];
  if (days === null) return true;
  const at = Date.parse(item.assignedAt ?? item.createdAt);
  return at >= now - days * 86_400_000;
}

function pct(value: number | null): string {
  return value === null ? '—' : `${String(value)}%`;
}

function downloadCsv(rows: ReportRow[], periodLabel: string): void {
  const header = ['Направление', 'Филиал', 'Руководитель', 'Менторов', 'Всего задач', 'Одобрено', 'Сдано в срок, %', 'Просрочено', 'Среднее время проверки'];
  const lines = rows.map((row) => [
    row.category,
    row.branch,
    row.lead ?? 'Не назначен',
    row.mentors,
    row.stats.total,
    row.stats.approved,
    row.stats.onTimePct ?? '',
    row.stats.overdue,
    formatHours(row.stats.avgReviewHours),
  ]);
  const escape = (value: string | number): string => {
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // `;` и BOM — чтобы Excel с русской локалью сразу открыл файл по колонкам и в UTF-8.
  const csv = '﻿' + [header, ...lines].map((line) => line.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Mentora — отчёт по направлениям (${periodLabel}).csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage(): JSX.Element {
  const dashboard = useDashboardQuery();
  const { query, items } = useAssignmentStats();
  const [now] = useState(() => Date.now());
  const periodLabel = DASHBOARD_PERIOD_LABEL[dashboard.period];

  // Только задания направлений из таблицы — чтобы итоги сверху сходились со строками ниже.
  const reportedCategoryIds = useMemo(() => new Set((dashboard.data?.categoryHealth ?? []).map((c) => c.categoryId)), [dashboard.data]);
  const periodItems = useMemo(
    () => items.filter((item) => reportedCategoryIds.has(item.categoryId) && inPeriod(item, dashboard.period, now)),
    [items, reportedCategoryIds, dashboard.period, now],
  );
  const totals = useMemo(() => computeAssignmentStats(periodItems), [periodItems]);

  const rows = useMemo<ReportRow[]>(() => {
    const byCategory = new Map<string, AssignmentDto[]>();
    for (const item of periodItems) byCategory.set(item.categoryId, [...(byCategory.get(item.categoryId) ?? []), item]);
    return (dashboard.data?.categoryHealth ?? [])
      .map((category) => ({
        key: category.categoryId,
        category: category.categoryName,
        branch: category.branchName,
        lead: category.leadName,
        mentors: category.mentorsCount,
        stats: computeAssignmentStats(byCategory.get(category.categoryId) ?? []),
      }))
      .sort((a, b) => b.stats.total - a.stats.total || a.category.localeCompare(b.category, 'ru'));
  }, [dashboard.data, periodItems]);

  const isPending = dashboard.isPending || query.isPending;
  const error = dashboard.error ?? query.error;

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Отчёты"
        subtitle="Сравнение направлений и филиалов: нагрузка, сроки и скорость проверки"
        action={
          <div className="flex items-center gap-2 print:hidden">
            <DashboardPeriodSelect value={dashboard.period} onChange={dashboard.setPeriod} />
            <ActionMenu
              align="end"
              ariaLabel="Экспорт отчёта"
              panelClassName="w-56"
              trigger={
                <Button variant="primary" leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />} disabled={rows.length === 0}>
                  Экспорт
                </Button>
              }
              items={[
                { id: 'csv', label: 'Таблица CSV (Excel)', icon: <FileSpreadsheet className="h-4 w-4" />, onSelect: () => { downloadCsv(rows, periodLabel); } },
                { id: 'pdf', label: 'PDF — через печать', icon: <FileText className="h-4 w-4" />, onSelect: () => { window.print(); } },
              ]}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList />} label="Заданий за период" value={String(totals.total)} hint={`${String(totals.active)} сейчас в работе`} />
        <PreviewMetricCard icon={<CheckCircle2 />} label="Одобрено" value={String(totals.approved)} hint={totals.completionPct === null ? 'Нет заданий' : `${String(totals.completionPct)}% от назначенных`} tone="success" />
        <PreviewMetricCard
          icon={<Timer />}
          label="Сдано в срок"
          value={pct(totals.onTimePct)}
          hint={`Среднее время проверки: ${formatHours(totals.avgReviewHours)}`}
          tooltip="Доля одобренных заданий, первая версия которых была сдана не позже дедлайна."
        />
        <PreviewMetricCard
          icon={<TriangleAlert />}
          label="Просрочено"
          value={String(totals.overdue)}
          hint={totals.overdue > 0 ? 'Срок истёк без сдачи' : 'Просрочек нет'}
          tone={totals.overdue > 0 ? 'danger' : 'default'}
          to={totals.overdue > 0 ? '/admin/assignments?status=overdue' : undefined}
        />
      </div>

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-divider px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Сравнение направлений</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Период: {periodLabel.toLowerCase()} · задания по дате назначения</p>
          </div>
        </div>
        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className="w-[16%]">Направление</PreviewTh>
            <PreviewTh className="w-[14%]">Филиал</PreviewTh>
            <PreviewTh className="w-[18%]">Руководитель</PreviewTh>
            <PreviewTh className="w-[8%] text-right">Менторов</PreviewTh>
            <PreviewTh className="w-[9%] text-right">Всего задач</PreviewTh>
            <PreviewTh className="w-[13%]">Сдано в срок</PreviewTh>
            <PreviewTh className="w-[9%] text-right">Просрочено</PreviewTh>
            <PreviewTh className="w-[13%] text-right">Ср. проверка</PreviewTh>
          </PreviewTableHead>
          <tbody>
            {isPending ? (
              <tr><td colSpan={8} className="py-2">{Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} columns={8} />)}</td></tr>
            ) : error !== null ? (
              <tr><td colSpan={8} className="px-5 py-2 sm:px-6"><ErrorState error={error} title="Не удалось построить отчёт" onRetry={() => { void dashboard.refetch(); void query.refetch(); }} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8}><EmptyState icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} title="Нет направлений" description="Создайте направление и назначьте руководителя — здесь появится сравнение." /></td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="h-14 border-b border-divider text-sm last:border-0 hover:bg-surface-hover">
                  <PreviewTd className="truncate font-medium text-ink">{row.category}</PreviewTd>
                  <PreviewTd className="truncate">{row.branch}</PreviewTd>
                  <PreviewTd>
                    {row.lead !== null ? (
                      <span className="flex min-w-0 items-center gap-2"><Avatar name={row.lead} size="xs" /><span className="truncate text-ink">{row.lead}</span></span>
                    ) : (
                      <span className="text-warning">Не назначен</span>
                    )}
                  </PreviewTd>
                  <PreviewTd className="text-right tabular-nums">{row.mentors}</PreviewTd>
                  <PreviewTd className="text-right tabular-nums text-ink">{row.stats.total}</PreviewTd>
                  <PreviewTd>
                    {row.stats.onTimePct === null ? (
                      <span className="text-ink-disabled">—</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="w-9 shrink-0 tabular-nums text-ink">{row.stats.onTimePct}%</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <span className={`block h-full rounded-full ${row.stats.onTimePct >= 80 ? 'bg-success' : row.stats.onTimePct >= 50 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${String(row.stats.onTimePct)}%` }} />
                        </span>
                      </span>
                    )}
                  </PreviewTd>
                  <PreviewTd className={`text-right tabular-nums ${row.stats.overdue > 0 ? 'font-semibold text-danger' : ''}`}>{row.stats.overdue}</PreviewTd>
                  <PreviewTd className="text-right tabular-nums">{formatHours(row.stats.avgReviewHours)}</PreviewTd>
                </tr>
              ))
            )}
          </tbody>
        </PreviewTable>
      </Card>
    </div>
  );
}

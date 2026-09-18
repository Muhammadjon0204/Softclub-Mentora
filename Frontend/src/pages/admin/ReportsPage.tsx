import { useDashboardQuery } from '../../features/admin-dashboard/useDashboardQuery';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { Card } from '../../shared/ui/Card';

export function ReportsPage(): JSX.Element {
  const query = useDashboardQuery();
  const report = query.data;
  const total = report?.kpis.activeAssignments ?? 0;
  const approved = report?.categoryHealth.reduce((sum, item) => sum + item.approvedCount, 0) ?? 0;
  return <div className="space-y-6"><PreviewPageHeader title="Отчёты" subtitle="Показатели из реального API" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetricCard icon={<span />} label="Активные задания" value={String(total)} /><PreviewMetricCard icon={<span />} label="Одобрены" value={String(approved)} /><PreviewMetricCard icon={<span />} label="Категории" value={String(report?.categoryHealth.length ?? 0)} /><PreviewMetricCard icon={<span />} label="Менторы" value={String(report?.kpis.activeMentors ?? 0)} /></div><Card>{query.isPending ? <p className="text-sm text-ink-muted">Загрузка отчёта…</p> : query.error ? <p className="text-sm text-danger">Не удалось загрузить отчёт.</p> : report?.categoryHealth.length === 0 ? <p className="text-sm text-ink-muted">Реальных результатов пока нет.</p> : <div className="space-y-3">{report?.categoryHealth.map((item) => <div key={item.categoryId} className="flex items-center justify-between border-b border-divider pb-3 text-sm"><span>{item.categoryName} · {item.branchName}</span><span className="tabular-nums text-ink-muted">{item.mentorsCount} менторов, {item.approvedCount} одобрено</span></div>)}</div>}</Card></div>;
}
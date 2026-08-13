import { CheckCircle2, ClipboardList, Clock3, TriangleAlert, Wrench } from 'lucide-react';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { LeadActivityChart } from '../../features/lead-dashboard/LeadActivityChart';
import { PriorityQueueCard } from '../../features/lead-dashboard/PriorityQueueCard';
import { TeamSummaryCard } from '../../features/lead-dashboard/TeamSummaryCard';
import { useLeadDashboard } from '../../features/lead-dashboard/useLeadDashboard';
import { useLeadScope } from '../../features/lead/scope/useLeadScope';
import { ChartCard } from '../../shared/ui/ChartCard';

/**
 * `/lead/dashboard` (ТЗ 2.2, раздел 24.4) — operational-обзор направления:
 * «что сейчас происходит с заданиями и менторами моего направления», а не
 * копия Organization/Branch Admin dashboard (раздел 12 задачи Phase 3). Все
 * значения — исключительно в scope собственной Category (`useLeadDashboard`).
 */
export function DashboardPage(): JSX.Element {
  const scope = useLeadScope();
  const { kpis, priorityItems, activity, team } = useLeadDashboard();

  return (
    <div className="space-y-5">
      <PreviewPageHeader
        title="Обзор"
        subtitle={`${scope.categoryName} · ${scope.branchDisplayName} — состояние заданий и команды за последние 30 дней`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <PreviewMetricCard icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} label="Активные задания" value={String(kpis.active)} />
        <PreviewMetricCard icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} label="Ожидают проверки" value={String(kpis.awaitingReview)} />
        <PreviewMetricCard icon={<Wrench className="h-5 w-5" aria-hidden="true" />} label="На доработке" value={String(kpis.rework)} />
        <PreviewMetricCard icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />} label="Просрочено" value={String(kpis.overdue)} tone="warning" />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} label="Одобрено за период" value={String(kpis.approvedPeriod)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <PriorityQueueCard items={priorityItems} />
        <TeamSummaryCard team={team} />
      </div>

      <ChartCard title="Активность направления" description="Назначено, отправлено и одобрено по дням" minHeight={300}>
        <LeadActivityChart data={activity} />
      </ChartCard>
    </div>
  );
}

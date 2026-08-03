import { ClipboardList, Clock3, UserCheck, Users } from 'lucide-react';

import type { DashboardKpis } from '../../api/admin/dashboard';
import { DashboardKpiCard } from './DashboardKpiCard';
import { deltaTone, sparklineFor } from './dashboardFormatters';

/**
 * Четыре KPI (раздел 5–6 промпта). Иконка-плитка везде одного мягкого
 * indigo-тона — различается только цвет sparkline на метрику, как на
 * референсе, а не сама плитка.
 */
export function DashboardKpiGrid({ kpis }: { kpis: DashboardKpis }): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardKpiCard
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
        label="Всего пользователей"
        value={kpis.totalUsers.toLocaleString('ru-RU')}
        deltaPct={kpis.totalUsersDeltaPct}
        deltaTone={deltaTone(kpis.totalUsersDeltaPct, true)}
        tooltip="Активные и приглашённые пользователи в текущем scope. Показатель на сейчас — не зависит от выбранного периода."
        sparkline={sparklineFor(kpis.totalUsers, 'rising')}
        sparklineColor="var(--primary)"
      />
      <DashboardKpiCard
        icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
        label="Активные менторы"
        value={kpis.activeMentors.toLocaleString('ru-RU')}
        deltaPct={kpis.activeMentorsDeltaPct}
        deltaTone={deltaTone(kpis.activeMentorsDeltaPct, true)}
        tooltip="Менторы с ролью Mentor и IsActive = true. Показатель на сейчас — не зависит от выбранного периода."
        sparkline={sparklineFor(kpis.activeMentors, 'wave')}
        sparklineColor="var(--secondary-blue)"
      />
      <DashboardKpiCard
        icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        label="Активные задания"
        value={kpis.activeAssignments.toLocaleString('ru-RU')}
        deltaPct={kpis.activeAssignmentsDeltaPct}
        deltaTone={deltaTone(kpis.activeAssignmentsDeltaPct, true)}
        tooltip="Assigned, Submitted, InReview, NeedsRework, Overdue. Показатель на сейчас — не зависит от выбранного периода."
        sparkline={sparklineFor(kpis.activeAssignments, 'spike')}
        sparklineColor="var(--success)"
      />
      <DashboardKpiCard
        icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
        label="Ожидают проверки"
        value={kpis.pendingReview.toLocaleString('ru-RU')}
        deltaPct={kpis.pendingReviewDeltaPct}
        deltaTone={deltaTone(kpis.pendingReviewDeltaPct, false)}
        tooltip="Submitted + InReview — задачи в очереди на проверку у Lead. Снижение — хороший результат. Показатель на сейчас — не зависит от выбранного периода."
        sparkline={sparklineFor(kpis.pendingReview, 'falling')}
        sparklineColor="var(--warning)"
      />
    </div>
  );
}

import { ClipboardList, Clock3, UserCheck, Users } from 'lucide-react';

import type { DashboardKpis } from '../../api/admin/dashboard';
import { PreviewMetricCard } from '../admin-preview/PreviewMetricCard';
import { deltaTone } from './dashboardFormatters';
import { StaggerContainer } from '../../shared/ui/motion';
import { intlLocale } from '../../shared/i18n/intl';

const VS_LAST_MONTH = 'к прошлому месяцу';

/** Четыре KPI обзора. Карточки заданий ведут сразу к отфильтрованному списку. */
export function DashboardKpiGrid({ kpis }: { kpis: DashboardKpis }): JSX.Element {
  return (
    <StaggerContainer className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <PreviewMetricCard
        icon={<Users aria-hidden="true" />}
        label="Всего пользователей"
        value={kpis.totalUsers.toLocaleString(intlLocale())}
        deltaPct={kpis.totalUsersDeltaPct}
        deltaTone={deltaTone(kpis.totalUsersDeltaPct, true)}
        hint={VS_LAST_MONTH}
        tooltip="Активные и приглашённые пользователи. Показатель на сейчас — не зависит от выбранного периода."
        to="/admin/users"
      />
      <PreviewMetricCard
        icon={<UserCheck aria-hidden="true" />}
        label="Активные менторы"
        value={kpis.activeMentors.toLocaleString(intlLocale())}
        deltaPct={kpis.activeMentorsDeltaPct}
        deltaTone={deltaTone(kpis.activeMentorsDeltaPct, true)}
        hint={VS_LAST_MONTH}
        tooltip="Менторы, которые сейчас активны. Показатель на сейчас — не зависит от выбранного периода."
        to="/admin/users"
      />
      <PreviewMetricCard
        icon={<ClipboardList aria-hidden="true" />}
        label="Активные задания"
        value={kpis.activeAssignments.toLocaleString(intlLocale())}
        deltaPct={kpis.activeAssignmentsDeltaPct}
        deltaTone={deltaTone(kpis.activeAssignmentsDeltaPct, true)}
        hint={VS_LAST_MONTH}
        tooltip="Назначены, сданы, на проверке, на доработке или просрочены — всё, что ещё не закрыто."
        to="/admin/assignments?status=open"
      />
      <PreviewMetricCard
        icon={<Clock3 aria-hidden="true" />}
        label="Ожидают проверки"
        value={kpis.pendingReview.toLocaleString(intlLocale())}
        deltaPct={kpis.pendingReviewDeltaPct}
        deltaTone={deltaTone(kpis.pendingReviewDeltaPct, false)}
        hint="Открыть очередь проверки"
        tooltip="Сданные решения, которые ждут руководителя. Чем меньше — тем лучше."
        tone={kpis.pendingReview > 0 ? 'warning' : 'default'}
        to="/admin/assignments?status=review"
      />
    </StaggerContainer>
  );
}

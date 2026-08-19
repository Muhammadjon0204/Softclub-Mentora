import { CheckCircle2, ClipboardCheck, ClipboardList, TriangleAlert, Wrench } from 'lucide-react';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { AttentionRequiredCard } from '../../features/mentor-dashboard/AttentionRequiredCard';
import { RecentActivityCard } from '../../features/mentor-dashboard/RecentActivityCard';
import { useMentorDashboard } from '../../features/mentor-dashboard/useMentorDashboard';
import { useMentorScope } from '../../features/mentor/scope/useMentorScope';

function currentHourInTimeZone(timeZoneId: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId, hour: 'numeric', hour12: false }).formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '12';
  return Number(hourPart) % 24;
}

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * `/mentor/dashboard` (ТЗ 2.2, раздел 24.5) — операционная сводка: сколько
 * заданий активно, что ждёт вашего действия, что произошло недавно. Только
 * собственные Assignment (`useScopedMentorAssignments` внутри
 * `useMentorDashboard`) — никакой командной аналитики, которой у Mentor по
 * ролевой модели нет. `title="Обзор"` — статичный, тот же приём, что
 * `pages/lead/DashboardPage.tsx` (совпадает с `MENTOR_NAV_ITEMS[0].label`,
 * см. `test/routing.test.tsx`); персональное приветствие — в subtitle.
 */
export function DashboardPage(): JSX.Element {
  const scope = useMentorScope();
  const { kpis, attentionItems, recentActivity } = useMentorDashboard();

  const greeting = `${greetingForHour(currentHourInTimeZone(scope.timeZoneId))}, ${firstNameOf(scope.mentorName)}`;

  return (
    <div className="space-y-5">
      <PreviewPageHeader title="Обзор" subtitle={`${greeting} — вот что происходит с вашими заданиями.`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <PreviewMetricCard icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} label="Активные задания" value={String(kpis.activeAssignments)} />
        <PreviewMetricCard icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />} label="На проверке" value={String(kpis.awaitingReview)} />
        <PreviewMetricCard icon={<Wrench className="h-5 w-5" aria-hidden="true" />} label="На доработке" value={String(kpis.rework)} tone={kpis.rework > 0 ? 'warning' : 'default'} />
        <PreviewMetricCard icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />} label="Просрочено" value={String(kpis.overdue)} tone={kpis.overdue > 0 ? 'warning' : 'default'} />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} label="Принято за 30 дней" value={String(kpis.approvedPeriod)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AttentionRequiredCard items={attentionItems} />
        <RecentActivityCard items={recentActivity} />
      </div>
    </div>
  );
}

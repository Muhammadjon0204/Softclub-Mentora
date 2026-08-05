import { AssignmentActivityChart } from '../../features/admin-dashboard/AssignmentActivityChart';
import { BestBranchCard } from '../../features/admin-dashboard/BestBranchCard';
import { DashboardHeader } from '../../features/admin-dashboard/DashboardHeader';
import { DashboardKpiCardSkeleton } from '../../features/admin-dashboard/DashboardKpiCard';
import { DashboardKpiGrid } from '../../features/admin-dashboard/DashboardKpiGrid';
import { RecentBusinessActivityCard } from '../../features/admin-dashboard/RecentBusinessActivityCard';
import { RoleDistributionChart } from '../../features/admin-dashboard/RoleDistributionChart';
import { TopMentorsCard } from '../../features/admin-dashboard/TopMentorsCard';
import { TopTeamsCard } from '../../features/admin-dashboard/TopTeamsCard';
import { UpcomingDeadlinesCard } from '../../features/admin-dashboard/UpcomingDeadlinesCard';
import { useDashboardQuery } from '../../features/admin-dashboard/useDashboardQuery';
import { Card } from '../../shared/ui/Card';
import { ChartCard, ChartCardSkeleton } from '../../shared/ui/ChartCard';
import { ErrorState } from '../../shared/ui/ErrorState';

export function DashboardPage(): JSX.Element {
  const query = useDashboardQuery();

  return (
    <div>
      <DashboardHeader
        period={query.period}
        onPeriodChange={query.setPeriod}
        isRefreshing={query.isRefetching}
        onRefresh={() => {
          void query.refetch();
        }}
      />

      <div className="mt-5">
        {query.isPending ? (
          <DashboardSkeleton />
        ) : query.data === undefined ? (
          <Card>
            <ErrorState
              error={query.error}
              title="Не удалось загрузить данные обзора"
              onRetry={() => {
                void query.refetch();
              }}
            />
          </Card>
        ) : (
          // Смена периода/филиала не должна резко «стирать» экран (раздел 4 полироли):
          // старые данные остаются на месте с мягким затемнением, пока не придёт ответ.
          <div className={`transition-opacity duration-200 ${query.isFetching ? 'opacity-60' : 'opacity-100'}`}>
            <DashboardContent data={query.data} />
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardContent({ data }: { data: NonNullable<ReturnType<typeof useDashboardQuery>['data']> }): JSX.Element {
  return (
    <>
      <DashboardKpiGrid kpis={data.kpis} />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <ChartCard title="Активность заданий" description="Отправлено, одобрено и просрочено по дням" minHeight={230}>
          <AssignmentActivityChart data={data.activitySeries} />
        </ChartCard>
        <ChartCard title="Распределение ролей" description="Администраторы, руководители, менторы" minHeight={230}>
          <RoleDistributionChart data={data.roleDistribution} />
        </ChartCard>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 items-stretch gap-4 auto-rows-fr md:grid-cols-2 min-[1420px]:grid-cols-[minmax(260px,0.82fr)_minmax(320px,1.02fr)_minmax(420px,1.36fr)]">
        <BestBranchCard insight={data.bestBranchInsight} />
        <TopTeamsCard categories={data.categoryHealth} />
        <div className="flex h-full min-w-0 flex-col md:col-span-2 min-[1420px]:col-span-1">
          <TopMentorsCard mentors={data.topMentors} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <RecentBusinessActivityCard auditEntries={data.recentAudit} assignmentEntries={data.recentAssignmentActivity} />
        <UpcomingDeadlinesCard deadlines={data.upcomingDeadlines} />
      </div>
    </>
  );
}

function InsightCardSkeleton({ className = '' }: { className?: string }): JSX.Element {
  return (
    <Card padded={false} className={`flex h-full min-h-[410px] flex-col gap-0 ${className}`} aria-hidden="true">
      <div className="min-h-[74px] space-y-1.5 border-b border-divider px-4 py-3.5">
        <div className="h-3.5 w-28 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-36 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-3.5 w-full animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
      <div className="min-h-[50px] border-t border-divider" />
    </Card>
  );
}

function BottomCardSkeleton(): JSX.Element {
  return (
    <Card padded={false} className="flex h-full flex-col gap-0" aria-hidden="true">
      <div className="space-y-1.5 border-b border-divider px-4 py-3.5">
        <div className="h-3.5 w-40 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="flex-1 space-y-4 px-4 py-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-3.5 w-full animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
      <div className="min-h-[50px] border-t border-divider" />
    </Card>
  );
}

function DashboardSkeleton(): JSX.Element {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка обзора…</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <DashboardKpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <ChartCardSkeleton minHeight={230} />
        <ChartCardSkeleton minHeight={230} />
      </div>
      <div className="mt-4 grid min-w-0 grid-cols-1 items-stretch gap-4 auto-rows-fr md:grid-cols-2 min-[1420px]:grid-cols-[minmax(260px,0.82fr)_minmax(320px,1.02fr)_minmax(420px,1.36fr)]">
        <InsightCardSkeleton />
        <InsightCardSkeleton />
        <InsightCardSkeleton className="md:col-span-2 min-[1420px]:col-span-1" />
      </div>
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <BottomCardSkeleton />
        <BottomCardSkeleton />
      </div>
    </div>
  );
}

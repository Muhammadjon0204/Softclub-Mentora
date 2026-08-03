import { CalendarDays, ClipboardList, Clock3, RefreshCw, UserCheck, Users } from 'lucide-react';

import type { ActivityPoint } from '../../api/admin/dashboard';
import { useAuth } from '../../auth/useAuth';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { ActivityChart } from '../../features/admin-dashboard/ActivityChart';
import { BranchHealthTable } from '../../features/admin-dashboard/BranchHealthTable';
import { CategoryHealthTable } from '../../features/admin-dashboard/CategoryHealthTable';
import { RecentActivityList } from '../../features/admin-dashboard/RecentActivityList';
import { RoleDonutChart } from '../../features/admin-dashboard/RoleDonutChart';
import { SystemHealthPanel } from '../../features/admin-dashboard/SystemHealthPanel';
import { useDashboardQuery } from '../../features/admin-dashboard/useDashboardQuery';
import { Button } from '../../shared/ui/Button';
import { Card, SectionCard } from '../../shared/ui/Card';
import { ChartCard, ChartCardSkeleton } from '../../shared/ui/ChartCard';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonRow } from '../../shared/ui/Skeleton';
import { StatCard, StatCardSkeleton } from '../../shared/ui/StatCard';
import type { DeltaTone } from '../../shared/ui/StatCard';

function deltaTone(deltaPct: number, moreIsBetter: boolean): DeltaTone {
  if (deltaPct === 0) return 'neutral';
  const isUp = deltaPct > 0;
  return isUp === moreIsBetter ? 'positive' : 'negative';
}

/**
 * Синтетические, но стабильные спарклайны вокруг текущего значения — без
 * Math.random. Каждая KPI-карточка получает свою форму тренда (раздел 2
 * сессии), а не один и тот же паттерн, растянутый под разный масштаб.
 */
const SPARKLINE_SHAPES = {
  rising: [0.78, 0.83, 0.89, 0.94, 0.98, 1.02, 1.08],
  wave: [0.92, 0.86, 0.8, 0.88, 0.97, 1.03, 1.06],
  spike: [0.85, 0.95, 1.08, 1.15, 1.05, 0.96, 1.02],
  falling: [1.1, 1.04, 0.99, 0.94, 0.9, 0.86, 0.83],
} as const;

function sparklineFor(value: number, shape: keyof typeof SPARKLINE_SHAPES): number[] {
  const base = Math.max(1, value);
  return SPARKLINE_SHAPES[shape].map((factor) => Math.round(base * factor));
}

/**
 * Диапазон в header считается из тех же точек, что рисует ActivityChart
 * (`dateLabel`) — единственный источник истины, чтобы header, ось X и
 * данные графика физически не могли разойтись (раздел 3 сессии).
 */
function activityRangeLabel(series: ActivityPoint[]): string | null {
  const first = series[0]?.dateLabel;
  const last = series.at(-1)?.dateLabel;
  if (first === undefined || last === undefined) return null;
  return first === last ? `${first} 2026` : `${first} – ${last} 2026`;
}

export function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const { isAllBranches, selectedBranchId, availableBranches } = useBranchContext();
  const query = useDashboardQuery();

  const isOrgAdmin = user?.role === 'Admin' && user.adminScope === 'Organization';
  const selectedBranchName = availableBranches.find((b) => b.id === selectedBranchId)?.name;

  const title = isAllBranches ? 'Обзор организации' : 'Обзор филиала';
  const subtitle = isAllBranches
    ? `Ключевые показатели всех филиалов ${user?.organization.name ?? ''}`
    : isOrgAdmin
      ? `Показатели филиала «${selectedBranchName ?? ''}»`
      : `Показатели филиала «${user?.branch?.name ?? ''}»`;

  const dateRangeLabel =
    query.data !== undefined ? activityRangeLabel(query.data.activitySeries) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-9 tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] text-ink-secondary sm:flex">
            <CalendarDays className="h-4 w-4 text-ink-muted" aria-hidden="true" />
            {dateRangeLabel ?? (
              <span aria-hidden="true" className="h-3.5 w-24 animate-pulse rounded bg-surface-muted" />
            )}
          </span>
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              void query.refetch();
            }}
            isLoading={query.isRefetching}
          >
            Обновить
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <Card>
          <ErrorState
            error={query.error}
            title="Не удалось загрузить обзор"
            onRetry={() => {
              void query.refetch();
            }}
          />
        </Card>
      ) : (
        <DashboardContent data={query.data} isAllBranches={isAllBranches} />
      )}
    </div>
  );
}

function DashboardContent({
  data,
  isAllBranches,
}: {
  data: NonNullable<ReturnType<typeof useDashboardQuery>['data']>;
  isAllBranches: boolean;
}): JSX.Element {
  const { kpis } = data;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
          label="Всего пользователей"
          value={kpis.totalUsers.toLocaleString('ru-RU')}
          deltaPct={kpis.totalUsersDeltaPct}
          deltaTone={deltaTone(kpis.totalUsersDeltaPct, true)}
          tooltip="Активные и приглашённые пользователи в текущем scope"
          sparkline={sparklineFor(kpis.totalUsers, 'rising')}
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" aria-hidden="true" />}
          label="Активные менторы"
          value={kpis.activeMentors.toLocaleString('ru-RU')}
          deltaPct={kpis.activeMentorsDeltaPct}
          deltaTone={deltaTone(kpis.activeMentorsDeltaPct, true)}
          tooltip="Менторы с ролью Mentor и IsActive = true"
          sparkline={sparklineFor(kpis.activeMentors, 'wave')}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          label="Активные задания"
          value={kpis.activeAssignments.toLocaleString('ru-RU')}
          deltaPct={kpis.activeAssignmentsDeltaPct}
          deltaTone={deltaTone(kpis.activeAssignmentsDeltaPct, true)}
          tooltip="Assigned, Submitted, InReview, NeedsRework, Overdue"
          sparkline={sparklineFor(kpis.activeAssignments, 'spike')}
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
          label="Ожидают проверки"
          value={kpis.pendingReview.toLocaleString('ru-RU')}
          deltaPct={kpis.pendingReviewDeltaPct}
          deltaTone={deltaTone(kpis.pendingReviewDeltaPct, false)}
          tooltip="Submitted + InReview — задачи в очереди на проверку у Lead"
          sparkline={sparklineFor(kpis.pendingReview, 'falling')}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard title="Активность платформы" description="Отправлено, одобрено и просрочено по дням">
            <ActivityChart data={data.activitySeries} />
          </ChartCard>
        </div>
        <ChartCard title="Распределение ролей" minHeight={220}>
          <RoleDonutChart data={data.roleDistribution} />
        </ChartCard>
      </div>

      <div className="mt-4">
        {isAllBranches && data.branchHealth !== null ? (
          <SectionCard title="Состояние филиалов" description="Сводка по каждому филиалу организации" padded={false}>
            <BranchHealthTable rows={data.branchHealth} />
          </SectionCard>
        ) : (
          <SectionCard title="Состояние категорий" description="Сводка по категориям текущего филиала" padded={false}>
            <CategoryHealthTable rows={data.categoryHealth} showBranchColumn={false} />
          </SectionCard>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Последняя активность" description="Последние действия и системные события" padded={false}>
          <RecentActivityList entries={data.recentAudit} />
          <div className="border-t border-divider px-5 py-3 sm:px-6">
            <Button variant="ghost" size="sm" disabled title="Журнал аудита — на следующем этапе">
              Открыть журнал
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Состояние системы" description="Ключевые зависимости приложения">
          <SystemHealthPanel
            services={data.systemHealth.services}
            recentEvents={data.systemHealth.recentEvents}
          />
        </SectionCard>
      </div>
    </>
  );
}

function DashboardSkeleton(): JSX.Element {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка обзора…</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCardSkeleton />
        </div>
        <ChartCardSkeleton minHeight={220} />
      </div>
      <div className="mt-4 space-y-0 rounded-card border border-line bg-surface">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonRow key={i} columns={5} />
        ))}
      </div>
    </div>
  );
}

import { useAuth } from '../../auth/useAuth';
import { useCategoriesForBranch } from '../admin-categories/useCategoriesQuery';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import type { PreviewBranchDetails } from './branchPresentation';

function healthTone(value: number): string {
  if (value >= 90) return 'text-success';
  if (value >= 75) return 'text-warning';
  return 'text-danger';
}

/** Компактная metric grid — не полноценный Dashboard внутри Drawer (раздел 26 промпта). */
export function BranchMetricsSection({ branch }: { branch: PreviewBranchDetails }): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const { users } = useUsersQuery();
  const { categories } = useCategoriesForBranch(branch.id, isOrgAdmin);
  const usersCount = users.filter((user) => user.branchId === branch.id && user.status !== 'Deactivated').length;
  const mentorsCount = users.filter((user) => user.branchId === branch.id && user.role === 'Mentor' && user.status !== 'Deactivated').length;

  const metrics = [
    { label: 'Пользователи', value: usersCount },
    { label: 'Направления', value: categories.length },
    { label: 'Менторы', value: mentorsCount },
    { label: 'Активные задания', value: branch.activeAssignments },
    { label: 'Индекс состояния', value: `${branch.healthPct}%`, tone: healthTone(branch.healthPct) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-control border border-line bg-surface p-3.5">
          <p className={`text-[19px] font-bold tabular-nums ${metric.tone ?? 'text-ink'}`}>{metric.value}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{metric.label}</p>
        </div>
      ))}
    </div>
  );
}

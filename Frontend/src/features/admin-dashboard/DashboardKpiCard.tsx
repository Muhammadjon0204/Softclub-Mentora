import { Card } from '../../shared/ui/Card';

/** Заглушка на время загрузки — той же высоты, что `PreviewMetricCard`. */
export function DashboardKpiCardSkeleton(): JSX.Element {
  return (
    <Card padded={false} className="flex h-full flex-col gap-2 px-4 py-3.5" aria-hidden="true">
      <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
      <div className="h-7 w-16 animate-pulse rounded bg-surface-muted" />
      <div className="h-3 w-28 animate-pulse rounded bg-surface-muted" />
    </Card>
  );
}

import { ArrowDownRight, ArrowUpRight, HelpCircle } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { Card } from '../../shared/ui/Card';
import { Tooltip } from '../../shared/ui/Tooltip';
import type { DeltaTone } from './dashboard.types';

interface DashboardKpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  deltaPct: number;
  deltaTone: DeltaTone;
  tooltip: string;
  sparkline: number[];
  /** CSS-переменная цвета (`var(--primary)` и т.п.) — своя для каждой метрики, не одна и та же линия везде. */
  sparklineColor: string;
}

const DELTA_CLASSES: Record<DeltaTone, string> = {
  positive: 'text-success bg-success-soft',
  negative: 'text-danger bg-danger-soft',
  neutral: 'text-ink-secondary bg-surface-muted',
};

function sparklineSeries(values: number[]): { i: number; v: number }[] {
  return values.map((v, i) => ({ i, v }));
}

/** Компактная executive KPI-карточка: sparkline рядом со значением, delta — маленький chip, не капсула. */
export function DashboardKpiCard({
  icon,
  label,
  value,
  deltaPct,
  deltaTone,
  tooltip,
  sparkline,
  sparklineColor,
}: DashboardKpiCardProps): JSX.Element {
  const isDown = deltaPct < 0;
  const gradientId = useId();

  return (
    <Card className="flex h-full flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand-soft text-brand">{icon}</span>
        <Tooltip content={tooltip}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full text-ink-disabled transition hover:bg-surface-hover hover:text-ink-muted">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Как считается «{label}»</span>
          </span>
        </Tooltip>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-ink-muted">{label}</p>
          <p className="mt-1 text-[27px] font-bold leading-8 tracking-tight text-ink tabular-nums">{value}</p>
        </div>
        <div className="h-9 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineSeries(sparkline)} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`kpi-spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.07} />
                  <stop offset="100%" stopColor={sparklineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparklineColor}
                strokeWidth={1.8}
                fill={`url(#kpi-spark-${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span
          className={`inline-flex shrink-0 items-center gap-0.5 rounded-[6px] px-1.5 py-0.5 text-[11.5px] font-semibold ${DELTA_CLASSES[deltaTone]}`}
        >
          {isDown ? (
            <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          )}
          {Math.abs(deltaPct).toFixed(1)}%
        </span>
        <span className="text-[11.5px] text-ink-muted">по сравнению с прошлым месяцем</span>
      </div>
    </Card>
  );
}

export function DashboardKpiCardSkeleton(): JSX.Element {
  return (
    <Card className="flex h-full flex-col gap-2.5 p-4" aria-hidden="true">
      <div className="h-8 w-8 animate-pulse rounded-[9px] bg-surface-muted" />
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
        <div className="h-7 w-20 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="h-5 w-28 animate-pulse rounded bg-surface-muted" />
    </Card>
  );
}

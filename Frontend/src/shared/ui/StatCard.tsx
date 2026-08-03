import { ArrowDownRight, ArrowUpRight, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { Card } from './Card';
import { Tooltip } from './Tooltip';

export type DeltaTone = 'positive' | 'negative' | 'neutral';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  deltaPct: number;
  /** Семантика направления определяется вызывающей стороной, а не знаком числа:
   *  падение «Ожидают проверки» — это хорошо, а не плохо. */
  deltaTone: DeltaTone;
  tooltip: string;
  sparkline: number[];
}

const DELTA_CLASSES: Record<DeltaTone, string> = {
  positive: 'text-success bg-success-soft',
  negative: 'text-danger bg-danger-soft',
  neutral: 'text-ink-secondary bg-surface-muted',
};

function sparklineSeries(values: number[]): { i: number; v: number }[] {
  return values.map((v, i) => ({ i, v }));
}

export function StatCard({
  icon,
  label,
  value,
  deltaPct,
  deltaTone,
  tooltip,
  sparkline,
}: StatCardProps): JSX.Element {
  const isDown = deltaPct < 0;

  return (
    <Card className="flex h-full flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft text-brand">
          {icon}
        </span>
        <Tooltip content={tooltip}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full text-ink-disabled transition hover:bg-surface-hover hover:text-ink-muted">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Как считается «{label}»</span>
          </span>
        </Tooltip>
      </div>

      <div>
        <p className="text-[13px] leading-[19px] text-ink-muted">{label}</p>
        <div className="mt-0.5 flex items-end justify-between gap-2">
          <p className="text-[30px] font-bold leading-9 tracking-tight text-ink tabular-nums">{value}</p>
          <div className="h-8 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineSeries(sparkline)} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill={`url(#spark-${label})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span
          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-semibold ${DELTA_CLASSES[deltaTone]}`}
        >
          {isDown ? (
            <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          )}
          {Math.abs(deltaPct).toFixed(1)}%
        </span>
        <span className="text-[12px] text-ink-muted">по сравнению с прошлым периодом</span>
      </div>
    </Card>
  );
}

export function StatCardSkeleton(): JSX.Element {
  return (
    <Card className="flex h-full flex-col gap-2.5" aria-hidden="true">
      <div className="h-9 w-9 animate-pulse rounded-control bg-surface-muted" />
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
        <div className="h-8 w-20 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="h-5 w-28 animate-pulse rounded-full bg-surface-muted" />
    </Card>
  );
}

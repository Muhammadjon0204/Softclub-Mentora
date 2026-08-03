import type { ReactNode } from 'react';

import { Card } from './Card';

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  minHeight?: number;
}

/** Карточка-обёртка для графиков: заголовок, легенда/действие, область charts. */
export function ChartCard({
  title,
  description,
  action,
  legend,
  children,
  minHeight = 280,
}: ChartCardProps): JSX.Element {
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold leading-[22px] text-ink">{title}</h2>
          {description !== undefined ? (
            <p className="mt-0.5 text-[13px] leading-[19px] text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action !== undefined ? <div className="shrink-0">{action}</div> : null}
      </div>
      {legend !== undefined ? (
        <div className="flex flex-wrap items-center gap-4 px-5 pt-4 sm:px-6">{legend}</div>
      ) : null}
      <div className="overflow-hidden px-2 pb-4 pt-3 sm:px-4" style={{ minHeight }}>
        {children}
      </div>
    </Card>
  );
}

export function ChartCardSkeleton({ minHeight = 280 }: { minHeight?: number }): JSX.Element {
  return (
    <Card padded={false} aria-hidden="true">
      <div className="border-b border-divider px-5 py-4 sm:px-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="flex items-center justify-center px-4 pb-4 pt-3" style={{ minHeight }}>
        <div className="h-full w-full animate-pulse rounded-lg bg-surface-muted" />
      </div>
    </Card>
  );
}

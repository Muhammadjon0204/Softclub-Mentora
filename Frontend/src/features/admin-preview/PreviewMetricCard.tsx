import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '../../shared/ui/Card';

interface PreviewMetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  /** Короткая подпись под значением вместо полноценного sparkline (раздел 3 сессии превью). */
  hint?: string;
  deltaPct?: number;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  tone?: 'default' | 'warning';
}

const ICON_TONE: Record<'default' | 'warning', string> = {
  default: 'bg-brand-soft text-brand',
  warning: 'bg-warning-soft text-warning',
};

const DELTA_CLASSES: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'text-success bg-success-soft',
  negative: 'text-danger bg-danger-soft',
  neutral: 'text-ink-secondary bg-surface-muted',
};

/**
 * Компактная KPI-карточка (~130px, раздел 10 layout-полироли): иконка и
 * delta-бейдж делят одну строку вместо отдельных вертикальных блоков —
 * это и даёт основную экономию высоты по сравнению с прежней версией.
 */
export function PreviewMetricCard({
  icon,
  label,
  value,
  hint,
  deltaPct,
  deltaTone = 'neutral',
  tone = 'default',
}: PreviewMetricCardProps): JSX.Element {
  return (
    <Card padded={false} className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-control ${ICON_TONE[tone]}`}>{icon}</span>
        {deltaPct !== undefined ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold ${DELTA_CLASSES[deltaTone]}`}
          >
            {deltaPct < 0 ? (
              <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            )}
            {Math.abs(deltaPct).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-[12.5px] leading-4 text-ink-muted">{label}</p>
        <p className="mt-0.5 text-[24px] font-bold leading-7 tracking-tight text-ink tabular-nums">{value}</p>
      </div>
      {hint !== undefined && deltaPct === undefined ? <p className="text-[11.5px] text-ink-muted">{hint}</p> : null}
    </Card>
  );
}

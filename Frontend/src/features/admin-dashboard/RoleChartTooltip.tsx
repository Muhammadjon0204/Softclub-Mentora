import type { CSSProperties } from 'react';

import { pluralizeRu } from './dashboardFormatters';

interface RoleChartTooltipProps {
  label: string;
  color: string;
  value: number;
  percent: number;
  style: CSSProperties;
}

/**
 * Компактный tooltip donut-диаграммы (раздел 8–9 полироли) — чисто
 * презентационный, без своей логики позиционирования: координаты приходит
 * готовыми из `RoleDistributionChart`, здесь только вёрстка карточки.
 */
export function RoleChartTooltip({ label, color, value, percent, style }: RoleChartTooltipProps): JSX.Element {
  return (
    <div
      role="status"
      style={style}
      className="pointer-events-none absolute z-50 min-w-[150px] max-w-[190px] rounded-[10px] border border-line bg-surface px-3 py-2.5 shadow-popover transition-opacity duration-100"
    >
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-[12.5px] font-semibold text-ink">{label}</span>
      </div>
      <p className="mt-1 text-[12px] text-ink-secondary">
        {value} {pluralizeRu(value, 'пользователь', 'пользователя', 'пользователей')}
      </p>
      <p className="text-[11.5px] text-ink-muted">{percent.toFixed(1)}% от общего числа</p>
    </div>
  );
}

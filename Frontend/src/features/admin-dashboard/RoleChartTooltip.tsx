import { pluralizeRu } from './dashboardFormatters';

interface RoleChartTooltipProps {
  label: string;
  color: string;
  value: number;
  percent: number;
}

/**
 * Компактный tooltip donut-диаграммы — чисто презентационный, без своей
 * логики позиционирования: рендерится внутри `ChartTooltipPortal`, который
 * отвечает за координаты (viewport-fixed, вне clipping-ancestor карточки).
 */
export function RoleChartTooltip({ label, color, value, percent }: RoleChartTooltipProps): JSX.Element {
  return (
    <div
      role="status"
      className="min-w-[165px] w-max max-w-[220px] rounded-[11px] border border-line bg-surface px-3 py-2.5 shadow-[0_10px_30px_rgba(25,35,60,0.10),0_2px_8px_rgba(25,35,60,0.06)]"
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

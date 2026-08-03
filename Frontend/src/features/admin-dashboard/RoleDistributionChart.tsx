import { useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';

import type { RoleDistribution } from '../../api/admin/dashboard';
import { RoleChartTooltip } from './RoleChartTooltip';

interface RoleDistributionChartProps {
  data: RoleDistribution;
}

const SEGMENTS = [
  { key: 'admins', label: 'Администраторы', color: 'var(--primary)' },
  { key: 'leads', label: 'Руководители направлений', color: 'var(--secondary-blue)' },
  { key: 'mentors', label: 'Менторы', color: 'var(--secondary-cyan)' },
] as const;

interface ActiveTooltip {
  index: number;
  /** Координаты уже в системе координат `outerRef` (карточка целиком), не donut-бокса. */
  x: number;
  y: number;
}

const TOOLTIP_HALF_HEIGHT = 40;

/**
 * Компактный donut с общим числом в центре. Tooltip раньше был встроенным
 * Recharts `<Tooltip>`, который рендерился по центру диаграммы и перекрывал
 * «36 / всего» (раздел 8 полироли) — здесь вместо него полностью самодельный
 * overlay, позиционируемый относительно наведённого сегмента/legend-строки,
 * а центр donut остаётся статичным при любом hover.
 */
export function RoleDistributionChart({ data }: RoleDistributionChartProps): JSX.Element {
  const total = data.admins + data.leads + data.mentors;
  const chartData = SEGMENTS.map((segment) => ({ ...segment, value: data[segment.key] }));
  const outerRef = useRef<HTMLDivElement | null>(null);
  const donutRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<ActiveTooltip | null>(null);

  const donutCenter = (): { x: number; y: number } | null => {
    if (outerRef.current === null || donutRef.current === null) return null;
    const outerRect = outerRef.current.getBoundingClientRect();
    const donutRect = donutRef.current.getBoundingClientRect();
    return {
      x: donutRect.left - outerRect.left + donutRect.width / 2,
      y: donutRect.top - outerRect.top + donutRect.height / 2,
    };
  };

  const handlePieMove = (_data: PieSectorDataItem, index: number, event: ReactMouseEvent<SVGGraphicsElement>): void => {
    if (outerRef.current === null) return;
    const outerRect = outerRef.current.getBoundingClientRect();
    const outerHeight = outerRect.height;
    const x = event.clientX - outerRect.left;
    const y = Math.max(TOOLTIP_HALF_HEIGHT, Math.min(event.clientY - outerRect.top, outerHeight - TOOLTIP_HALF_HEIGHT));
    setActive({ index, x, y });
  };

  const handleLegendActivate = (index: number) => (event: ReactMouseEvent<HTMLButtonElement> | { currentTarget: HTMLButtonElement }): void => {
    if (outerRef.current === null) return;
    const outerRect = outerRef.current.getBoundingClientRect();
    const itemRect = event.currentTarget.getBoundingClientRect();
    const x = itemRect.left - outerRect.left;
    const y = Math.max(
      TOOLTIP_HALF_HEIGHT,
      Math.min(itemRect.top - outerRect.top + itemRect.height / 2, outerRect.height - TOOLTIP_HALF_HEIGHT),
    );
    setActive({ index, x, y });
  };

  const clearActive = (): void => {
    setActive(null);
  };

  const center = active !== null ? donutCenter() : null;
  const tooltipStyle =
    active !== null && center !== null
      ? active.x >= center.x
        ? { left: active.x + 12, top: active.y, transform: 'translate(0, -50%)' }
        : { left: active.x - 12, top: active.y, transform: 'translate(-100%, -50%)' }
      : null;

  return (
    <div ref={outerRef} className="relative flex flex-wrap items-center justify-center gap-6 overflow-visible">
      <div ref={donutRef} className="relative h-[168px] w-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={handlePieMove}
              onMouseMove={handlePieMove}
              onMouseLeave={clearActive}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  stroke={active?.index === index ? entry.color : 'var(--surface)'}
                  strokeWidth={active?.index === index ? 3 : 2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-ink">{total}</span>
          <span className="text-[12px] text-ink-muted">всего</span>
        </div>
      </div>

      <ul className="min-w-[180px] space-y-0.5">
        {chartData.map((entry, index) => (
          <li key={entry.key}>
            <button
              type="button"
              onMouseEnter={handleLegendActivate(index)}
              onFocus={handleLegendActivate(index)}
              onMouseLeave={clearActive}
              onBlur={clearActive}
              className="flex w-full items-center gap-2 rounded-[8px] px-1.5 py-[5px] text-left text-[13px] transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="truncate text-ink-secondary">{entry.label}</span>
              <span className="ml-auto shrink-0 font-semibold tabular-nums text-ink">{entry.value}</span>
            </button>
          </li>
        ))}
      </ul>

      {active !== null && tooltipStyle !== null ? (
        <RoleChartTooltip
          label={chartData[active.index].label}
          color={chartData[active.index].color}
          value={chartData[active.index].value}
          percent={total === 0 ? 0 : (chartData[active.index].value / total) * 100}
          style={tooltipStyle}
        />
      ) : null}
    </div>
  );
}

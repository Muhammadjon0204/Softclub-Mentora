import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';

import type { RoleDistribution } from '../../api/admin/dashboard';
import { ChartTooltipPortal } from './ChartTooltipPortal';
import type { FloatingTooltipPoint } from './floatingTooltipPosition';
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
  strategy: 'radial' | 'anchor';
  anchor: FloatingTooltipPoint;
}

/**
 * Компактный donut с общим числом в центре. Tooltip рендерится через
 * `ChartTooltipPortal` (position:fixed + createPortal → document.body):
 * раньше это был position:absolute внутри карточки, и его обрезал
 * `overflow-hidden` на ChartCard при hover у левого/верхнего края (см.
 * floatingTooltipPosition.ts — radial placement + flip + viewport clamp).
 * Центр donut остаётся статичным при любом hover — anchor для сегмента и
 * legend-строки считается в viewport-координатах, а не относительно карточки.
 */
export function RoleDistributionChart({ data }: RoleDistributionChartProps): JSX.Element {
  const total = data.admins + data.leads + data.mentors;
  const chartData = SEGMENTS.map((segment) => ({ ...segment, value: data[segment.key] }));
  const donutRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const lastActiveRef = useRef<ActiveTooltip | null>(null);
  if (active !== null) {
    lastActiveRef.current = active;
  }
  // При скрытии портал ещё ~70мс остаётся mounted для fade-out — рендерим последние
  // известные данные/позицию, а не null, иначе tooltip «схлопывается» перед исчезновением.
  const renderedActive = active ?? lastActiveRef.current;

  const donutCenter = (): FloatingTooltipPoint | null => {
    if (donutRef.current === null) return null;
    const rect = donutRef.current.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const handlePieMove = useCallback((_data: PieSectorDataItem, index: number, event: ReactMouseEvent<SVGGraphicsElement>): void => {
    setActive({ index, strategy: 'radial', anchor: { x: event.clientX, y: event.clientY } });
  }, []);

  const handleLegendActivate = useCallback(
    (index: number) =>
      (event: ReactMouseEvent<HTMLButtonElement> | { currentTarget: HTMLButtonElement }): void => {
        const itemRect = event.currentTarget.getBoundingClientRect();
        setActive({
          index,
          strategy: 'anchor',
          anchor: { x: itemRect.right, y: itemRect.top + itemRect.height / 2 },
        });
      },
    [],
  );

  const clearActive = useCallback((): void => {
    setActive(null);
  }, []);

  const handleLegendKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
      if (event.key === 'Escape') {
        clearActive();
        event.currentTarget.blur();
      }
    },
    [clearActive],
  );

  // На основе renderedActive (не active), чтобы центр оставался корректным и во время fade-out.
  const center = renderedActive?.strategy === 'radial' ? donutCenter() : null;

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-6">
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
              onKeyDown={handleLegendKeyDown}
              aria-label={`${entry.label}: ${entry.value}`}
              className="flex w-full items-center gap-2 rounded-[8px] px-1.5 py-[5px] text-left text-[13px] transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="truncate text-ink-secondary">{entry.label}</span>
              <span className="ml-auto shrink-0 font-semibold tabular-nums text-ink">{entry.value}</span>
            </button>
          </li>
        ))}
      </ul>

      <ChartTooltipPortal
        visible={active !== null}
        anchor={renderedActive?.anchor ?? null}
        strategy={renderedActive?.strategy ?? 'radial'}
        centerAnchor={center}
        preferredPlacement={renderedActive?.strategy === 'anchor' ? 'right' : undefined}
        onDismiss={clearActive}
      >
        {renderedActive !== null ? (
          <RoleChartTooltip
            label={chartData[renderedActive.index].label}
            color={chartData[renderedActive.index].color}
            value={chartData[renderedActive.index].value}
            percent={total === 0 ? 0 : (chartData[renderedActive.index].value / total) * 100}
          />
        ) : null}
      </ChartTooltipPortal>
    </div>
  );
}

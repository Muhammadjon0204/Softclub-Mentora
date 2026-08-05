import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';

import type { ActivityPoint } from '../../api/admin/dashboard';
import { ChartTooltipPortal } from './ChartTooltipPortal';
import type { FloatingTooltipPoint } from './floatingTooltipPosition';

interface AssignmentActivityChartProps {
  data: ActivityPoint[];
}

/** Просрочено — приглушённый amber, не ярко-красный (раздел 8 промпта). */
const SERIES = [
  { key: 'approved', name: 'Одобрено', color: 'var(--success)' },
  { key: 'submitted', name: 'Отправлено', color: 'var(--primary)' },
  { key: 'overdue', name: 'Просрочено', color: 'var(--warning)' },
] as const;

interface LineTooltipItem {
  key: string;
  name: string;
  color: string;
  value: number;
}

interface LineTooltipContent {
  label: string;
  items: LineTooltipItem[];
}

interface LineTooltipState {
  active: boolean;
  anchor: FloatingTooltipPoint | null;
  content: LineTooltipContent | null;
}

function sameContent(a: LineTooltipContent | null, b: LineTooltipContent | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.label !== b.label || a.items.length !== b.items.length) return false;
  return a.items.every((item, index) => item.value === b.items[index]?.value && item.key === b.items[index]?.key);
}

function sameAnchor(a: FloatingTooltipPoint | null, b: FloatingTooltipPoint | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.x === b.x && a.y === b.y;
}

function LineChartTooltipContent({ label, items }: LineTooltipContent): JSX.Element {
  return (
    <div className="min-w-[165px] w-max max-w-[220px] rounded-[11px] border border-line bg-surface px-3 py-2.5 shadow-[0_10px_30px_rgba(25,35,60,0.10),0_2px_8px_rgba(25,35,60,0.06)]">
      <p className="text-[13px] font-semibold leading-4 text-ink">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
            <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="flex-1 truncate">{item.name}</span>
            <span className="font-semibold tabular-nums text-ink">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Recharts вызывает `content` при каждом hover/re-render — здесь только
 * пробрасываем payload/coordinate наверх через `onChange`, без собственного
 * визуального вывода (возвращает null). Реальный tooltip рендерится через
 * `ChartTooltipPortal` (position:fixed + portal), а не Recharts-овским
 * внутренним wrapper'ом, который иначе клэмпится к viewBox графика.
 */
function LineTooltipBridge({
  active,
  payload,
  label,
  coordinate,
  onChange,
}: TooltipContentProps & { onChange: (state: LineTooltipState) => void }): null {
  useEffect(() => {
    if (active !== true || coordinate === undefined || payload === undefined || payload.length === 0) {
      onChange({ active: false, anchor: null, content: null });
      return;
    }
    const items: LineTooltipItem[] = SERIES.filter((series) => payload.some((entry) => entry.dataKey === series.key)).map((series) => {
      const entry = payload.find((item) => item.dataKey === series.key);
      return { key: series.key, name: series.name, color: series.color, value: Number(entry?.value ?? 0) };
    });
    onChange({
      active: true,
      anchor: { x: coordinate.x, y: coordinate.y },
      content: { label: typeof label === 'string' ? label : String(label ?? ''), items },
    });
  }, [active, coordinate?.x, coordinate?.y, label, payload, onChange]);
  return null;
}

/** Тонкая горизонтальная сетка, без вертикальных линий, dot только на hover. */
export function AssignmentActivityChart({ data }: AssignmentActivityChartProps): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<LineTooltipState>({ active: false, anchor: null, content: null });
  const lastContentRef = useRef<LineTooltipContent | null>(null);
  if (state.content !== null) {
    lastContentRef.current = state.content;
  }
  const renderedContent = state.content ?? lastContentRef.current;

  const handleTooltipChange = useCallback((next: LineTooltipState): void => {
    setState((prev) => {
      const anchor = sameAnchor(prev.anchor, next.anchor) ? prev.anchor : next.anchor;
      const content = sameContent(prev.content, next.content) ? prev.content : next.content;
      if (prev.active === next.active && anchor === prev.anchor && content === prev.content) {
        return prev;
      }
      return { active: next.active, anchor, content };
    });
  }, []);

  const handleDismiss = useCallback((): void => {
    setState((prev) => (prev.active ? { ...prev, active: false } : prev));
  }, []);

  // viewport-координаты для fixed-tooltip: chartRect.left/top + SVG-координата курсора (раздел 4 промпта).
  const viewportAnchor: FloatingTooltipPoint | null =
    state.anchor !== null && wrapperRef.current !== null
      ? { x: wrapperRef.current.getBoundingClientRect().left + state.anchor.x, y: wrapperRef.current.getBoundingClientRect().top + state.anchor.y }
      : null;

  return (
    <div ref={wrapperRef} className="relative">
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--divider)" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <RechartsTooltip content={(props) => <LineTooltipBridge {...props} onChange={handleTooltipChange} />} />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 12.5, color: 'var(--text-secondary)' }}
          />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.name}
              stroke={series.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <ChartTooltipPortal visible={state.active} anchor={viewportAnchor} strategy="cursor" onDismiss={handleDismiss}>
        {renderedContent !== null ? <LineChartTooltipContent label={renderedContent.label} items={renderedContent.items} /> : null}
      </ChartTooltipPortal>
    </div>
  );
}

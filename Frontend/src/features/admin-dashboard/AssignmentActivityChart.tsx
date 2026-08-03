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

import type { ActivityPoint } from '../../api/admin/dashboard';

interface AssignmentActivityChartProps {
  data: ActivityPoint[];
}

/** Просрочено — приглушённый amber, не ярко-красный (раздел 8 промпта). */
const SERIES = [
  { key: 'approved', name: 'Одобрено', color: 'var(--success)' },
  { key: 'submitted', name: 'Отправлено', color: 'var(--primary)' },
  { key: 'overdue', name: 'Просрочено', color: 'var(--warning)' },
] as const;

/** Тонкая горизонтальная сетка, без вертикальных линий, dot только на hover. */
export function AssignmentActivityChart({ data }: AssignmentActivityChartProps): JSX.Element {
  return (
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
        <RechartsTooltip
          allowEscapeViewBox={{ x: false, y: false }}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 10px rgba(16,24,40,0.08)',
            fontSize: 13,
          }}
          labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
        />
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
  );
}

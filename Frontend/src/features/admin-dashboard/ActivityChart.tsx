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

interface ActivityChartProps {
  data: ActivityPoint[];
}

const SERIES = [
  { key: 'submitted', name: 'Отправлено', color: 'var(--primary)' },
  { key: 'approved', name: 'Одобрено', color: 'var(--secondary-cyan)' },
  { key: 'overdue', name: 'Просрочено', color: 'var(--warning)' },
] as const;

/** Тонкая сетка, спокойный tooltip, без 3D-эффектов и глянца (раздел 32 промпта). */
export function ActivityChart({ data }: ActivityChartProps): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={260}>
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
          width={40}
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
          height={32}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 13, color: 'var(--text-secondary)' }}
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

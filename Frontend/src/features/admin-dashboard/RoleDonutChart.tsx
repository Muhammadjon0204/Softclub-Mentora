import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

import type { RoleDistribution } from '../../api/admin/dashboard';

interface RoleDonutChartProps {
  data: RoleDistribution;
}

const SEGMENTS = [
  { key: 'admins', label: 'Администраторы', color: 'var(--primary)' },
  { key: 'leads', label: 'Руководители направлений', color: 'var(--secondary-blue)' },
  { key: 'mentors', label: 'Менторы', color: 'var(--secondary-cyan)' },
] as const;

/** Компактный donut с общим числом в центре — без легенды на 10+ категорий (раздел 32). */
export function RoleDonutChart({ data }: RoleDonutChartProps): JSX.Element {
  const total = data.admins + data.leads + data.mentors;
  const chartData = SEGMENTS.map((segment) => ({ ...segment, value: data[segment.key] }));

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 4px 10px rgba(16,24,40,0.08)',
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-ink">{total}</span>
          <span className="text-[12px] text-ink-muted">всего</span>
        </div>
      </div>

      <ul className="space-y-2.5">
        {chartData.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2 text-[13px]">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-ink-secondary">{entry.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

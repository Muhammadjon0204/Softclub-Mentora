import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';

import type { ActivityPoint } from './useLeadDashboard';

const SERIES = [
  { key: 'assigned', name: 'Назначено', color: 'var(--primary)' },
  { key: 'submitted', name: 'Отправлено', color: 'var(--info, var(--primary))' },
  { key: 'approved', name: 'Одобрено', color: 'var(--success)' },
] as const;

/**
 * Активность направления за 14 дней — Assigned/Submission/Approved события
 * из собственных заданий Lead. Высота/отступы увеличены (Lead UI upgrade,
 * раздел 4.4): график не должен выглядеть «зажатым» под легендой. Чёрная
 * focus-обводка снята глобально в index.css — здесь достаточно инлайн
 * `outline: none` как defensive fallback на случай инлайн-стилей браузера.
 */
export function LeadActivityChart({ data }: { data: ActivityPoint[] }): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }} style={{ outline: 'none' }}>
        <defs>
          {SERIES.map((series) => (
            <linearGradient key={series.key} id={`lead-activity-${series.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={series.color} stopOpacity={0.22} />
              <stop offset="95%" stopColor={series.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--divider)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          padding={{ left: 8, right: 8 }}
        />
        <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <RechartsTooltip
          cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1, strokeDasharray: '3 4' }}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 10px 30px rgba(25,35,60,0.10), 0 2px 8px rgba(25,35,60,0.06)',
            fontSize: 12,
            padding: '8px 12px',
          }}
          labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ padding: '1px 0' }}
        />
        <Legend
          verticalAlign="top"
          align="left"
          height={36}
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 12.5, color: 'var(--text-secondary)', paddingBottom: 8 }}
        />
        {SERIES.map((series) => (
          <Area
            key={series.key}
            type="monotone"
            dataKey={series.key}
            name={series.name}
            stroke={series.color}
            strokeWidth={2.25}
            fill={`url(#lead-activity-${series.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

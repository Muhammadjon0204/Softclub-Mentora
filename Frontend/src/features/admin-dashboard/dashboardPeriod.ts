/**
 * Аналитический период Dashboard (раздел 3–5 полироли) — заменяет свободный
 * calendar date-range picker. URL — единственный источник истины (раздел 4):
 * никакого localStorage, значение живёт только в `?period=`.
 */
export type DashboardPeriod = 'all' | '1m' | '3m' | '6m' | '1y';

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = '1m';

const PERIOD_VALUES: readonly DashboardPeriod[] = ['all', '1m', '3m', '6m', '1y'];

export const DASHBOARD_PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'all', label: 'За всё время' },
  { value: '1m', label: 'Последний месяц' },
  { value: '3m', label: 'Последние 3 месяца' },
  { value: '6m', label: 'Последние 6 месяцев' },
  { value: '1y', label: 'Последний год' },
];

export const DASHBOARD_PERIOD_LABEL: Record<DashboardPeriod, string> = {
  all: 'За всё время',
  '1m': 'Последний месяц',
  '3m': 'Последние 3 месяца',
  '6m': 'Последние 6 месяцев',
  '1y': 'Последний год',
};

/** Неизвестное/битое значение в URL всегда откатывается к дефолту, а не падает. */
export function parseDashboardPeriod(raw: string | null): DashboardPeriod {
  return raw !== null && (PERIOD_VALUES as readonly string[]).includes(raw) ? (raw as DashboardPeriod) : DEFAULT_DASHBOARD_PERIOD;
}

import { ArrowDownRight, ArrowUpRight, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Tooltip } from '../../shared/ui/Tooltip';

export type MetricTone = 'default' | 'warning' | 'danger' | 'success';

interface PreviewMetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  /** Короткая подпись под значением. */
  hint?: ReactNode;
  deltaPct?: number;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  /** `warning`/`danger` — только когда показатель действительно требует внимания (значение > 0). */
  tone?: MetricTone;
  /** Пояснение «как считается» — иконка (?) рядом с подписью. */
  tooltip?: string;
  /** Карточка-ссылка: переход к отфильтрованному списку. */
  to?: string;
  /** Карточка-фильтр на той же странице. */
  onClick?: () => void;
  /** Подсветка, когда фильтр этой карточки включён. */
  active?: boolean;
}

const ICON_TONE: Record<MetricTone, string> = {
  default: 'text-ink-disabled',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-success',
};

const VALUE_TONE: Record<MetricTone, string> = {
  default: 'text-ink',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-ink',
};

const ACCENT: Record<MetricTone, string> = {
  default: '',
  warning: 'border-warning-border',
  danger: 'border-danger-border',
  success: '',
};

const DELTA_CLASSES: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'text-success bg-success-soft',
  negative: 'text-danger bg-danger-soft',
  neutral: 'text-ink-secondary bg-surface-muted',
};

/**
 * Компактная KPI-плитка (~88px): подпись мелко сверху, крупная цифра, рядом — динамика,
 * иконка маленькая в правом углу без цветной подложки. Без декоративных sparkline'ов.
 * С `to`/`onClick` становится быстрым фильтром.
 */
export function PreviewMetricCard({
  icon,
  label,
  value,
  hint,
  deltaPct,
  deltaTone = 'neutral',
  tone = 'default',
  tooltip,
  to,
  onClick,
  active = false,
}: PreviewMetricCardProps): JSX.Element {
  const interactive = to !== undefined || onClick !== undefined;
  const className = [
    'group relative flex h-full min-w-0 flex-col rounded-card border bg-surface px-4 py-3.5 text-left shadow-surface transition',
    active ? 'border-brand ring-1 ring-brand' : tone === 'default' || tone === 'success' ? 'border-line' : ACCENT[tone],
    interactive ? 'cursor-pointer no-underline hover:border-line-strong hover:shadow-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand' : '',
  ].join(' ');

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[12px] font-medium leading-4 text-ink-muted">
          <span className="truncate">{label}</span>
          {tooltip !== undefined ? (
            <Tooltip content={tooltip}>
              <span className="inline-flex shrink-0 text-ink-disabled hover:text-ink-muted">
                <HelpCircle className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Как считается «{label}»</span>
              </span>
            </Tooltip>
          ) : null}
        </span>
        <span className={`shrink-0 [&>svg]:h-4 [&>svg]:w-4 ${ICON_TONE[tone]}`} aria-hidden="true">{icon}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`text-[24px] font-semibold leading-7 tracking-tight tabular-nums ${VALUE_TONE[tone]}`}>{value}</span>
        {deltaPct !== undefined ? (
          <span className={`inline-flex items-center gap-0.5 rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold ${DELTA_CLASSES[deltaTone]}`}>
            {deltaPct < 0 ? <ArrowDownRight className="h-3 w-3" aria-hidden="true" /> : <ArrowUpRight className="h-3 w-3" aria-hidden="true" />}
            {Math.abs(deltaPct).toFixed(1)}%
          </span>
        ) : null}
      </div>
      {hint !== undefined ? <p className="mt-1 truncate text-[11.5px] text-ink-muted">{hint}</p> : null}
    </>
  );

  if (to !== undefined) {
    return <Link to={to} className={className}>{body}</Link>;
  }
  if (onClick !== undefined) {
    return <button type="button" onClick={onClick} aria-pressed={active} className={className}>{body}</button>;
  }
  return <div className={className}>{body}</div>;
}

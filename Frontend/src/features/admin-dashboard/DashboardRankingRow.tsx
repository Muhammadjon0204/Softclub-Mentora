import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface DashboardRankingRowProps {
  rank: number;
  icon?: ReactNode;
  avatar?: ReactNode;
  title: string;
  subtitle?: string;
  value: string;
  /** 0–100, ширина сравнительной progress-линии (не официальный процент). */
  progress?: number;
  progressLabel?: string;
  isLeader?: boolean;
  /** У «Топ менторов» value-текст длиннее («N одобрено»), места на «Лидер» рядом не остаётся — только цвет ранга. */
  showLeaderLabel?: boolean;
  href: string;
  ariaLabel: string;
}

/**
 * Единая строка рейтинга (раздел 14–16 полироли) — используется и в «Лучшие
 * команды», и в «Топ 5 менторов», чтобы обе карточки не выглядели как две
 * независимо собранные системы. Настоящий `<Link>`, а не `div onClick` —
 * клавиатурный фокус и `aria-label` обязательны без исключений.
 */
export function DashboardRankingRow({
  rank,
  icon,
  avatar,
  title,
  subtitle,
  value,
  progress,
  progressLabel,
  isLeader = false,
  showLeaderLabel = true,
  href,
  ariaLabel,
}: DashboardRankingRowProps): JSX.Element {
  return (
    <Link
      to={href}
      aria-label={ariaLabel}
      className="group relative my-0.5 flex min-h-[54px] items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 no-underline transition-colors duration-150 hover:border-line hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:bg-surface-muted motion-reduce:transition-none"
    >
      <span
        className={`w-6 shrink-0 text-center text-[12px] font-semibold tabular-nums ${isLeader ? 'text-brand' : 'text-ink-muted'}`}
        aria-hidden="true"
      >
        {String(rank).padStart(2, '0')}
      </span>

      {icon ?? avatar ?? null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink" title={title}>
          {title}
        </p>
        {subtitle !== undefined ? <p className="mt-px truncate text-[11.5px] text-ink-muted">{subtitle}</p> : null}
        {progress !== undefined ? (
          <div
            className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-surface-muted"
            role={progressLabel !== undefined ? 'img' : undefined}
            aria-label={progressLabel}
            title={progressLabel}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-[180ms] motion-reduce:transition-none"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-ink-secondary">{value}</span>
        {isLeader && showLeaderLabel ? <span className="whitespace-nowrap text-[10.5px] font-medium text-ink-muted">Лидер</span> : null}
        <ChevronRight
          className="h-[15px] w-[15px] shrink-0 -translate-x-0.5 text-ink-muted opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

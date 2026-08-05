import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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

const TOOLTIP_DELAY_MS = 300;

/**
 * Tooltip только когда текст реально обрезан эллипсисом (scrollWidth >
 * clientWidth). Не переиспользует общий `Tooltip` (тот оборачивает контент в
 * inline-flex span, из-за чего truncate перестаёт работать — блок перестаёт
 * растягиваться на ширину колонки identity, ellipsis никогда не появляется).
 */
function TruncatableText({ text, className }: { text: string; className: string }): JSX.Element {
  const textRef = useRef<HTMLParagraphElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const [isTruncated, setIsTruncated] = useState(false);
  const [visible, setVisible] = useState(false);
  const id = useId();

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el === null) return undefined;

    const checkTruncation = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };
    checkTruncation();

    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [text]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  const show = (): void => {
    if (!isTruncated) return;
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, TOOLTIP_DELAY_MS);
  };
  const hide = (): void => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <span className="relative block w-full min-w-0" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <p ref={textRef} className={className} aria-describedby={isTruncated && visible ? id : undefined}>
        {text}
      </p>
      {isTruncated && visible ? (
        <span
          role="tooltip"
          id={id}
          className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 w-max max-w-[300px] whitespace-normal rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[12px] leading-[16px] text-ink shadow-popover animate-fade-in"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Единая строка рейтинга (раздел 14–16 полироли) — используется и в «Лучшие
 * команды», и в «Топ 5 менторов», чтобы обе карточки не выглядели как две
 * независимо собранные системы. rank|icon|identity|metric|chevron — явный
 * CSS grid, а не flex: identity получает всё свободное пространство
 * (minmax(0,1fr)), metric остаётся max-content и не сжимает имя/название.
 * Ширина identity автоматически разная между карточками, потому что разная
 * ширина самой карточки — не нужен отдельный grid-template на каждую.
 * Настоящий `<Link>`, а не `div onClick` — клавиатурный фокус и `aria-label`
 * обязательны без исключений.
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
      className="group relative my-0.5 grid min-h-[54px] w-full min-w-0 grid-cols-[26px_32px_minmax(0,1fr)_max-content_16px] items-center gap-x-2.5 rounded-[10px] border border-transparent px-2.5 py-2 no-underline transition-[background-color,border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-line hover:bg-surface-hover hover:shadow-[0_1px_6px_rgba(15,23,42,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:bg-surface-muted motion-reduce:transition-[background-color,border-color] motion-reduce:hover:translate-y-0"
    >
      <span
        className={`text-center text-[12px] font-semibold tabular-nums ${isLeader ? 'text-brand' : 'text-ink-muted'}`}
        aria-hidden="true"
      >
        {String(rank).padStart(2, '0')}
      </span>

      {icon ?? avatar ?? null}

      <div className="min-w-0">
        <TruncatableText text={title} className="truncate text-[13.5px] font-semibold leading-[18px] text-ink" />
        {subtitle !== undefined ? (
          <TruncatableText text={subtitle} className="mt-px truncate text-[11.5px] leading-4 text-ink-muted" />
        ) : null}
        {progress !== undefined ? (
          <div
            className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-surface-muted"
            role={progressLabel !== undefined ? 'img' : undefined}
            aria-label={progressLabel}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-[180ms] motion-reduce:transition-none"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-self-end gap-1.5">
        <span className="whitespace-nowrap text-right text-[12.5px] font-semibold tabular-nums text-ink-secondary">{value}</span>
        {isLeader && showLeaderLabel ? <span className="whitespace-nowrap text-[10.5px] font-medium text-ink-muted">Лидер</span> : null}
      </div>

      <ChevronRight
        className="h-[15px] w-[15px] shrink-0 -translate-x-0.5 text-ink-muted opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  );
}

import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { forwardRef } from 'react';

/**
 * Единая table-система preview-страниц (layout polish, раздел 3 сессии).
 *
 * `table-layout: fixed` + явная ширина на каждом `PreviewTh` — колонки больше
 * не «раздувают» таблицу под контент. Естественный минимум ширины таблицы —
 * это просто сумма явных ширин колонок, поэтому отдельный inline `minWidth`
 * не нужен: он и был источником горизонтального scroll на 1536px (див с
 * `overflow-x-auto` зажат grid-колонкой без `min-w-0`, а таблица внутри всё
 * равно требовала свои 900+px). Прокрутка при нехватке места остаётся, но
 * теперь только внутри этого div — не на уровне страницы.
 */
export function PreviewTable({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="min-w-0 w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left">{children}</table>
    </div>
  );
}

export function PreviewTableHead({ children }: { children: ReactNode }): JSX.Element {
  return (
    <thead>
      <tr className="h-11 text-[12px] font-semibold text-ink-secondary">{children}</tr>
    </thead>
  );
}

/** `sticky` на каждой `th` (не на `tr`/`thead`) — единственный кросс-браузерный надёжный вариант. */
export function PreviewTh({ children, className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return (
    <th
      scope="col"
      className={`sticky top-0 z-10 truncate border-b border-divider bg-surface px-3 font-semibold first:pl-5 first:sm:pl-6 last:pr-5 last:sm:pr-6 ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

interface PreviewTrProps {
  children: ReactNode;
  onClick?: () => void;
  /** Подсветка primary-soft для строки, открытой в detail-drawer. */
  selected?: boolean;
}

/** `forwardRef`, чтобы страницы могли вернуть фокус на строку после закрытия drawer. */
export const PreviewTr = forwardRef<HTMLTableRowElement, PreviewTrProps>(function PreviewTr(
  { children, onClick, selected = false },
  ref,
) {
  return (
    <tr
      ref={ref}
      onClick={onClick}
      tabIndex={onClick !== undefined ? -1 : undefined}
      className={`h-14 border-b border-divider text-sm outline-none last:border-0 ${
        selected ? 'bg-brand-soft' : 'hover:bg-surface-hover'
      } ${onClick !== undefined ? 'cursor-pointer' : ''}`}
    >
      {children}
    </tr>
  );
});

export function PreviewTd({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return (
    <td className={`px-3 text-ink-secondary first:pl-5 first:sm:pl-6 last:pr-5 last:sm:pr-6 ${className}`} {...rest}>
      {children}
    </td>
  );
}

/**
 * Компактная двухстрочная ячейка: основной текст (truncate + tooltip) и
 * вторичный (text-xs, muted, truncate) — заменяет разбросанные по отдельным
 * колонкам secondary-данные (раздел 6 дефектов: Scope, User cell, Actor cell).
 */
export function PreviewCellStack({
  primary,
  secondary,
  tooltip,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  tooltip?: string;
}): JSX.Element {
  return (
    <div className="min-w-0" title={tooltip}>
      <p className="truncate text-[13.5px] font-medium text-ink">{primary}</p>
      {secondary !== undefined && secondary !== null ? (
        <p className="truncate text-xs text-ink-muted">{secondary}</p>
      ) : null}
    </div>
  );
}

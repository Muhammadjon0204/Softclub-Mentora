import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MouseEvent, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { Select } from '../../shared/select';

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

/** Заголовок финальной колонки с action-menu (`…`) — используется вместе с `PreviewActionCell`. */
export function PreviewActionTh(): JSX.Element {
  return <PreviewTh className="w-14" aria-label="Действия" />;
}

/**
 * Финальная ячейка строки с action-menu trigger (`…`). `w-14` уже комфортно
 * вмещает 32px IconButton, но правильная защита — не ширина колонки, а
 * `flex justify-end` вместо `text-align`: при `table-layout: fixed` узкая
 * фикс-колонка (`w-11`) даёт content-box уже самого триггера, и `text-center`/
 * `text-right` в этом случае непредсказуемо прижимают кнопку вплотную к самому
 * краю таблицы (0px отступа) — ровно баг «троеточие прилипло к краю».
 * `justify-end` детерминированно держит кнопку у padding-края контейнера, а
 * не у его border-края, весь overflow уходит влево, а не вправо.
 */
export function PreviewActionCell({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLTableCellElement>) => void;
}): JSX.Element {
  return (
    <PreviewTd className="w-14" onClick={onClick}>
      <div className="flex items-center justify-end">{children}</div>
    </PreviewTd>
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

export interface PreviewPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Единый table-footer пагинации (Users, Assignments — раньше каждая страница
 * верстала свою копию с разным baseline: то текстовые `‹ ›`, то Chevron-иконки).
 * Живёт рядом с `PreviewTable`, потому что визуально это её footer, а не
 * отдельный кусок UI — тот же `border-t border-divider`, тот же px/py, что и
 * `PreviewToolbar` сверху таблицы.
 */
export function PreviewPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: PreviewPaginationProps): JSX.Element {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3.5 text-[13px] text-ink-muted sm:px-6">
      <span>
        Показано {start}–{end} из {totalCount}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
          На странице
          <Select
            ariaLabel="Строк на странице"
            size="sm"
            value={String(pageSize)}
            onValueChange={(next) => { onPageSizeChange(Number(next)); }}
            options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
            fullWidth={false}
            className="w-[68px]"
          />
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => { onPageChange(page - 1); }}
            aria-label="Предыдущая страница"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pageNumbers.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => { onPageChange(number); }}
              aria-current={number === page ? 'page' : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-medium transition ${
                number === page ? 'bg-brand-soft text-brand' : 'text-ink-secondary hover:bg-surface-hover'
              }`}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => { onPageChange(page + 1); }}
            aria-label="Следующая страница"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

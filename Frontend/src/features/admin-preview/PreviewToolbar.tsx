import { ListFilter, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { Select } from '../../shared/select';

/** Общая полоса фильтров: одинаковая высота/spacing на всех preview-страницах. */
export function PreviewToolbar({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2.5 border-b border-divider px-5 py-3.5 sm:px-6">
      {children}
    </div>
  );
}

interface PreviewSearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** minmax(240px, 1fr) из раздела 9: растёт и занимает свободное место, не зажат маленьким max-width. */
export function PreviewSearchInput({ placeholder, value, onChange, className = '' }: PreviewSearchInputProps): JSX.Element {
  return (
    <div
      className={`flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-control border border-line bg-surface px-3 ${className}`}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-disabled"
      />
    </div>
  );
}

/**
 * Семантические ширины filter-select'ов вместо россыпи магических чисел по
 * страницам — `sm` для коротких значений (статус/результат/канал), `md` для
 * средних (роль/lead/период), `lg` для длинных (филиал/категория). Значения —
 * середина диапазонов, которые фактически используются на всех filter-страницах.
 */
export const FILTER_SELECT_WIDTH = {
  sm: 'w-[160px]',
  md: 'w-[185px]',
  lg: 'w-[205px]',
} as const;

export type FilterSelectWidth = keyof typeof FILTER_SELECT_WIDTH;

interface PreviewSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  width?: FilterSelectWidth;
  className?: string;
}

/**
 * Кастомный dropdown в стилистике остальных toolbar-контролов. `fullWidth={false}`
 * обязателен: `SelectTrigger` по умолчанию тянется на 100% контейнера (это нужно
 * формам/drawer'ам) — без этого флага компактная ширина ниже молча проигрывала бы
 * `w-full` в CSS-каскаде, и каждый select растягивался бы на всю строку toolbar,
 * ломая его на вертикальный стек.
 */
export function PreviewSelect({ label, value, onChange, options, width = 'md', className = '' }: PreviewSelectProps): JSX.Element {
  return (
    <Select
      ariaLabel={label}
      value={value}
      onValueChange={onChange}
      options={options}
      fullWidth={false}
      className={`shrink-0 ${FILTER_SELECT_WIDTH[width]} ${className}`}
    />
  );
}

export function PreviewResetButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border border-line bg-surface px-3 text-[13px] font-medium text-ink-secondary transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface disabled:hover:text-ink-secondary"
    >
      <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
      Сбросить
    </button>
  );
}

import { ListFilter, Search } from 'lucide-react';
import type { ReactNode } from 'react';

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

interface PreviewSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

/** Нативный `<select>` в стилистике остальных контролов; ширина 140–180px, фиксированная (раздел 9). */
export function PreviewSelect({ label, value, onChange, options, className = 'w-[160px]' }: PreviewSelectProps): JSX.Element {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={`h-10 shrink-0 rounded-control border border-line bg-surface px-3 text-[13px] text-ink-secondary outline-none transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function PreviewResetButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border border-line bg-surface px-3 text-[13px] font-medium text-ink-secondary transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
      Сбросить
    </button>
  );
}

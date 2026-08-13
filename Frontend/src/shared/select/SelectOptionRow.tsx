import { Check } from 'lucide-react';

import type { SelectOption } from './selectTypes';

export interface SelectOptionRowProps {
  option: SelectOption;
  isSelected: boolean;
  /** Клавиатурная/hover подсветка — не то же самое, что `isSelected`. */
  isActive: boolean;
  onSelect: () => void;
  onRef?: (node: HTMLButtonElement | null) => void;
}

/** Одна строка списка — общая для `Select` и `SearchSelect` (раздел 3 промпта: одна система, не по одной на страницу). */
export function SelectOptionRow({ option, isSelected, isActive, onSelect, onRef }: SelectOptionRowProps): JSX.Element {
  return (
    <button
      ref={onRef}
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled}
      disabled={option.disabled}
      tabIndex={-1}
      onClick={option.disabled === true ? undefined : onSelect}
      className={`flex h-9 w-full shrink-0 items-center justify-between gap-2 rounded-control-sm px-2.5 text-left text-[13px] transition ${
        option.disabled === true
          ? 'cursor-not-allowed text-ink-disabled'
          : isSelected
            ? 'bg-brand-soft font-medium text-brand'
            : isActive
              ? 'bg-surface-hover text-ink'
              : 'text-ink-secondary hover:bg-surface-hover'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">
        {option.label}
        {option.description !== undefined ? <span className="ml-1.5 text-ink-muted">{option.description}</span> : null}
      </span>
      {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
    </button>
  );
}

export function SelectEmptyState({ message = 'Ничего не найдено' }: { message?: string }): JSX.Element {
  return <p className="px-3 py-5 text-center text-[13px] text-ink-muted">{message}</p>;
}

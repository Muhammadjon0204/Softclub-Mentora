import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export interface SelectTriggerProps {
  triggerRef: (node: HTMLButtonElement | null) => void;
  label: string;
  showPlaceholder: boolean;
  isOpen: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: 'sm' | 'md';
  id?: string;
  name?: string;
  ariaLabel?: string;
  onClick: () => void;
  className?: string;
  leadingIcon?: ReactNode;
  /** `true` (по умолчанию) — trigger заполняет контейнер (форма/drawer). `false` — ширина
   *  целиком отдаётся `className` (filter toolbar): без этого `w-full` всегда выигрывал
   *  бы каскад у любой `w-[…]`, переданной вызывающей стороной, — именно так узкие
   *  filter-select'ы неожиданно растягивались на 100% и ломали toolbar на строки. */
  fullWidth?: boolean;
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-8 px-2 text-[13px]',
  md: 'h-10 px-3 text-[13px]',
};

/** Общий trigger-button для `Select`/`SearchSelect` — визуально идентичен FormInput/PreviewSearchInput (раздел 4 промпта). */
export function SelectTrigger({
  triggerRef,
  label,
  showPlaceholder,
  isOpen,
  disabled,
  invalid,
  size = 'md',
  id,
  name,
  ariaLabel,
  onClick,
  className = '',
  leadingIcon,
  fullWidth = true,
}: SelectTriggerProps): JSX.Element {
  return (
    <button
      ref={triggerRef}
      type="button"
      id={id}
      name={name}
      disabled={disabled}
      onClick={onClick}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      aria-invalid={invalid === true ? true : undefined}
      className={`flex shrink-0 items-center justify-between gap-2 rounded-control border bg-surface text-left text-ink outline-none transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-disabled disabled:hover:bg-surface-muted ${fullWidth ? 'w-full' : ''} ${SIZE_CLASSES[size]} ${invalid === true ? 'border-danger' : 'border-line'} ${className}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {leadingIcon}
        <span className={`min-w-0 flex-1 truncate ${showPlaceholder ? 'text-ink-disabled' : 'text-ink'}`}>{label}</span>
      </span>
      <ChevronDown
        className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        aria-hidden="true"
      />
    </button>
  );
}

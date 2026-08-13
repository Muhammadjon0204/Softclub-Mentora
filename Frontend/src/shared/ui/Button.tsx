import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from '../../components/ui/Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * Opacity-модификатор поверх CSS-переменного цвета (`bg-brand/50`) в этой
 * сборке Tailwind не генерируется — класс просто не попадает в CSS, и
 * disabled/hover-состояние визуально не отличалось от обычного (Lead UI
 * upgrade, раздел 11: тот же класс бага, что «чёрные рамки» у графиков).
 * Arbitrary rgba() — тот же цвет токена, без opacity-резолюции темы.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-sm hover:bg-brand-hover active:bg-brand-active disabled:bg-[rgba(91,92,226,0.5)]',
  secondary:
    'border border-line bg-surface text-ink hover:bg-surface-hover active:bg-surface-hover disabled:text-ink-disabled',
  ghost: 'text-ink-secondary hover:bg-surface-hover hover:text-ink disabled:text-ink-disabled',
  danger: 'bg-danger text-white shadow-sm hover:bg-[rgba(201,74,74,0.9)] active:bg-danger disabled:bg-[rgba(201,74,74,0.5)]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-control-sm px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-control px-4 text-sm',
};

/**
 * Базовая кнопка Admin UI. Четыре варианта, два размера — сознательно без
 * матрицы «на каждый случай свой компонент»: варианты покрывают все действия
 * раздела 22 промпта (primary/secondary/ghost/destructive).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    isLoading = false,
    leadingIcon,
    trailingIcon,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      disabled={disabled === true || isLoading}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : leadingIcon !== undefined ? (
        <span aria-hidden="true" className="-ml-0.5 flex shrink-0 items-center">
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {!isLoading && trailingIcon !== undefined ? (
        <span aria-hidden="true" className="-mr-0.5 flex shrink-0 items-center">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
}

const ICON_BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 rounded-control-sm',
  md: 'h-10 w-10 rounded-control',
};

/** Кнопка «только иконка» — `aria-label` обязателен (раздел 30 промпта). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', active = false, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${ICON_BUTTON_SIZE[size]} ${active ? 'bg-brand-soft text-brand' : VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  );
});

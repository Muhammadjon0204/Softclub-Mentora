import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from '../ui/Spinner';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isSubmitting?: boolean;
  /** Текст для screen reader'а во время отправки. */
  submittingLabel?: string;
  children: ReactNode;
}

/**
 * Состояние submitting: кнопка disabled, спиннер ВНУТРИ кнопки, текст остаётся
 * читаемым. Скелетоны здесь не используются — форма не должна «прыгать».
 */
export function SubmitButton({
  isSubmitting = false,
  submittingLabel = 'Отправка…',
  disabled = false,
  children,
  className = '',
  ...rest
}: SubmitButtonProps): JSX.Element {
  return (
    <button
      type="submit"
      disabled={disabled || isSubmitting}
      aria-busy={isSubmitting}
      className={
        'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 ' +
        'text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ' +
        'disabled:cursor-not-allowed disabled:bg-indigo-300 ' +
        className
      }
      {...rest}
    >
      {isSubmitting ? (
        <>
          <Spinner className="h-4 w-4" />
          <span className="sr-only">{submittingLabel}</span>
        </>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

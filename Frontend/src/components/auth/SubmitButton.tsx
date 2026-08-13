import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from '../ui/Spinner';

type ButtonTone = 'default' | 'auth';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isSubmitting?: boolean;
  /** Текст для screen reader'а во время отправки. */
  submittingLabel?: string;
  children: ReactNode;
  tone?: ButtonTone;
}

const TONE_CLASS: Record<ButtonTone, string> = {
  default:
    'rounded-xl bg-indigo-600 px-4 py-2.5 text-sm shadow-sm hover:bg-indigo-700 ' +
    'focus-visible:outline-indigo-600 disabled:bg-indigo-300',
  auth:
    'h-[46px] rounded-control bg-brand px-4 text-[15px] shadow-none hover:bg-brand-hover active:bg-brand-active ' +
    'focus-visible:outline-brand disabled:bg-[rgba(91,92,226,0.4)]',
};

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
  tone = 'default',
  ...rest
}: SubmitButtonProps): JSX.Element {
  return (
    <button
      type="submit"
      disabled={disabled || isSubmitting}
      aria-busy={isSubmitting}
      className={
        'inline-flex w-full items-center justify-center gap-2 font-semibold text-white transition ' +
        'motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
        'disabled:cursor-not-allowed ' +
        `${TONE_CLASS[tone]} ${className}`
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

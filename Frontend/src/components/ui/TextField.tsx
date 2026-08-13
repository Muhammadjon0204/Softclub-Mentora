import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';

/**
 * `auth` — премиальный вид формы входа (раздел 6/13 брендинга Login):
 * токены Mentora Panel вместо сырых slate/indigo. `default` не трогаем —
 * им пользуются ForgotPassword/Reset/SetPassword и менять их вид не просили.
 */
type FieldTone = 'default' | 'auth';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  tone?: FieldTone;
}

const BASE_INPUT: Record<FieldTone, string> = {
  default:
    'block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ' +
    'placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ' +
    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
  auth:
    'block h-11 w-full rounded-control border bg-surface px-3.5 text-[15px] text-ink shadow-none ' +
    'placeholder:text-ink-disabled transition-colors duration-150 focus:outline-none ' +
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-disabled motion-reduce:transition-none',
};

const LABEL_CLASS: Record<FieldTone, string> = {
  default: 'block text-sm font-medium text-slate-700',
  auth: 'block text-sm font-medium text-ink-secondary',
};

const ERROR_CLASS: Record<FieldTone, string> = {
  default: 'text-sm text-rose-600',
  auth: 'text-sm text-danger',
};

const HINT_CLASS: Record<FieldTone, string> = {
  default: 'text-sm text-slate-500',
  auth: 'text-sm text-ink-muted',
};

/**
 * Tailwind (эта сборка) не генерирует класс вида `focus:ring-brand/10` —
 * сочетание variant + opacity-модификатор на CSS-переменном цвете молча
 * пропадает, и фокус откатывается на дефолтный синий `--tw-ring-color`
 * (та самая «сильная синяя заливка» из ТЗ). Обходим arbitrary-values
 * с готовым rgba — им опасен ту же ловушку.
 */
const AUTH_FOCUS_RING = 'focus:ring-[3px] focus:ring-[rgba(91,92,226,0.16)]';
const AUTH_FOCUS_RING_ERROR = 'focus:ring-[3px] focus:ring-[rgba(201,74,74,0.16)]';

function inputClasses(hasError: boolean, tone: FieldTone, extra = ''): string {
  const toneClasses =
    tone === 'auth'
      ? hasError
        ? `border-danger focus:border-danger ${AUTH_FOCUS_RING_ERROR}`
        : `border-line hover:border-line-strong focus:border-brand focus:hover:border-brand ${AUTH_FOCUS_RING}`
      : hasError
        ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200';
  return `${BASE_INPUT[tone]} ${toneClasses} ${extra}`;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, tone = 'default', className = '', ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error !== undefined ? `${inputId}-error` : hint !== undefined ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className={LABEL_CLASS[tone]}>
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        ref={ref}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={inputClasses(error !== undefined, tone, className)}
      />
      {error !== undefined ? (
        <p id={`${inputId}-error`} className={ERROR_CLASS[tone]}>
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${inputId}-hint`} className={HINT_CLASS[tone]}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

type PasswordFieldProps = Omit<TextFieldProps, 'type'>;

const TOGGLE_BUTTON_CLASS: Record<FieldTone, string> = {
  default:
    'absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition ' +
    'hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500 motion-reduce:transition-none',
  auth:
    'absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-ink-disabled transition-colors duration-150 ' +
    'hover:text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand motion-reduce:transition-none',
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ label, error, hint, id, tone = 'default', className = '', ...rest }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    const describedBy =
      error !== undefined ? `${inputId}-error` : hint !== undefined ? `${inputId}-hint` : undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className={LABEL_CLASS[tone]}>
          {label}
        </label>
        <div className="relative">
          <input
            {...rest}
            id={inputId}
            ref={ref}
            type={visible ? 'text' : 'password'}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
            className={inputClasses(error !== undefined, tone, `pr-11 ${className}`)}
          />
          <button
            type="button"
            onClick={() => {
              setVisible((current) => !current);
            }}
            aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
            className={TOGGLE_BUTTON_CLASS[tone]}
          >
            {visible ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l18 18" strokeLinecap="round" />
                <path d="M10.6 10.6a2 2 0 002.8 2.8" strokeLinecap="round" />
                <path d="M6.7 6.9C4.6 8.2 3 10.3 2.5 12c1 3.2 5 6 9.5 6 1.6 0 3.1-.4 4.4-1M9.9 5.2A8.9 8.9 0 0112 5c4.5 0 8.5 2.8 9.5 6-.3 1-1 2.2-2.1 3.2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2.5 12C3.5 8.8 7.5 6 12 6s8.5 2.8 9.5 6c-1 3.2-5 6-9.5 6s-8.5-2.8-9.5-6z" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            )}
          </button>
        </div>
        {error !== undefined ? (
          <p id={`${inputId}-error`} className={ERROR_CLASS[tone]}>
            {error}
          </p>
        ) : hint !== undefined ? (
          <p id={`${inputId}-hint`} className={HINT_CLASS[tone]}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

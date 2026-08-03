import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

const BASE_INPUT =
  'block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

function inputClasses(hasError: boolean, extra = ''): string {
  const tone = hasError
    ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200';
  return `${BASE_INPUT} ${tone} ${extra}`;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className = '', ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error !== undefined ? `${inputId}-error` : hint !== undefined ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        ref={ref}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={inputClasses(error !== undefined, className)}
      />
      {error !== undefined ? (
        <p id={`${inputId}-error`} className="text-sm text-rose-600">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${inputId}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

type PasswordFieldProps = Omit<TextFieldProps, 'type'>;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ label, error, hint, id, className = '', ...rest }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    const describedBy =
      error !== undefined ? `${inputId}-error` : hint !== undefined ? `${inputId}-hint` : undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
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
            className={inputClasses(error !== undefined, `pr-11 ${className}`)}
          />
          <button
            type="button"
            onClick={() => {
              setVisible((current) => !current);
            }}
            tabIndex={-1}
            aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
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
          <p id={`${inputId}-error`} className="text-sm text-rose-600">
            {error}
          </p>
        ) : hint !== undefined ? (
          <p id={`${inputId}-hint`} className="text-sm text-slate-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

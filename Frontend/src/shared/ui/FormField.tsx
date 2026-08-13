import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { Select } from '../select';
import type { SelectProps } from '../select';

/**
 * Лёгкие form-примитивы Admin UI, совместимые с `react-hook-form` (`register()`
 * возвращает `ref`/`name`/`onChange`/`onBlur` — все три control ниже их принимают
 * через обычный spread). Визуально отдельны от auth-страниц `TextField`/
 * `PasswordField` (те — under `components/ui`, другая, более ранняя палитра) —
 * здесь только токены Admin design system (`ink`/`brand`/`control`).
 */

const CONTROL_BASE =
  'h-10 w-full rounded-control border bg-surface px-3 text-[13px] text-ink outline-none transition placeholder:text-ink-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-disabled';

function controlTone(invalid: boolean | undefined): string {
  return invalid === true ? 'border-danger' : 'border-line';
}

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Обёртка label + control + error/hint — сам control передаётся через `children`. */
export function FormField({ label, htmlFor, required = false, error, hint, children, className = '' }: FormFieldProps): JSX.Element {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-[12.5px] font-medium text-ink-secondary">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error !== undefined ? (
        <p id={`${htmlFor}-error`} className="text-[11.5px] text-danger">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${htmlFor}-hint`} className="text-[11.5px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria-invalid/aria-describedby для control внутри `FormField` — id должен совпадать с `htmlFor`. */
export function fieldA11yProps(id: string, error?: string, hint?: string): { 'aria-invalid'?: boolean; 'aria-describedby'?: string } {
  if (error !== undefined) return { 'aria-invalid': true, 'aria-describedby': `${id}-error` };
  if (hint !== undefined) return { 'aria-describedby': `${id}-hint` };
  return {};
}

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(function FormInput(
  { invalid, className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`${CONTROL_BASE} ${controlTone(invalid)} ${className}`} {...rest} />;
});

/**
 * Кастомный dropdown (раздел 3 промпта «убрать native `<select>`»), не
 * браузерный `<select>` — API прежний по духу (`invalid`/`id`/`disabled`),
 * но `value`/`onChange(event)`/`<option>`-дети заменены на `value`/`onValueChange`/`options`.
 */
export type FormSelectProps = SelectProps;
export const FormSelect = Select;

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(function FormTextarea(
  { invalid, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`min-h-[80px] w-full resize-none rounded-control border bg-surface px-3 py-2.5 text-[13px] text-ink outline-none transition placeholder:text-ink-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-disabled ${controlTone(invalid)} ${className}`}
      {...rest}
    />
  );
});

interface FormCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(function FormCheckbox(
  { label, description, id, className = '', ...rest },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  return (
    <label htmlFor={checkboxId} className={`flex cursor-pointer items-start gap-2.5 select-none ${className}`}>
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        {...rest}
      />
      <span>
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {description !== undefined ? <span className="mt-0.5 block text-[11.5px] text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
});

/** Заголовок секции формы (раздел 40 промпта): 13–14px semibold + опциональное описание. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {description !== undefined ? <p className="mt-0.5 text-[12px] text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Read-only поле формы — спокойный surface, не «выцветший disabled» (раздел 40 промпта). */
export function ReadOnlyField({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <span className="block text-[12.5px] font-medium text-ink-secondary">{label}</span>
      <div className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface-muted px-3 text-[13px] text-ink-secondary">
        {icon !== undefined ? (
          <span aria-hidden="true" className="flex h-3.5 w-3.5 shrink-0 items-center text-ink-muted">
            {icon}
          </span>
        ) : null}
        <span className="truncate">{value}</span>
      </div>
      {hint !== undefined ? <p className="text-[11.5px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** Общая шапка inline-ошибки формы (сервер/mock conflict) — не закрывает Drawer. */
export function FormBannerError({ message }: { message: string }): JSX.Element {
  return (
    <p role="alert" className="rounded-control-sm border border-danger-border bg-danger-soft px-3 py-2.5 text-[12.5px] text-danger">
      {message}
    </p>
  );
}

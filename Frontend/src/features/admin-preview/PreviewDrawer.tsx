import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { IconButton } from '../../shared/ui/Button';

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Detail-drawers (Assignments/Audit) чуть шире формы создания — 440–480px вместо max-w-md. */
  width?: 'form' | 'detail';
}

/**
 * Overlay-drawer поверх layout: создание сущности (Users) и detail-панели
 * (Assignments/Audit) — вместо постоянных правых колонок, которые растягивались
 * на всю высоту страницы (раздел 4/6/7 дефектов layout-полироли).
 */
export function PreviewDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'form',
}: PreviewDrawerProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Закрыть панель"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 animate-fade-in"
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-full animate-slide-in-right flex-col border-l border-line bg-surface shadow-popover ${
          width === 'detail' ? 'max-w-[460px]' : 'max-w-md'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-divider px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold leading-[22px] text-ink">{title}</h2>
            {description !== undefined ? (
              <p className="mt-0.5 text-[13px] leading-[19px] text-ink-muted">{description}</p>
            ) : null}
          </div>
          <IconButton label="Закрыть" size="sm" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer !== undefined ? <div className="border-t border-divider px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}

export function PreviewField({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

const FIELD_CLASSES =
  'h-10 w-full rounded-control border border-line bg-surface px-3 text-[13px] text-ink outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export function PreviewTextInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={FIELD_CLASSES}
    />
  );
}

export function PreviewFieldSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={FIELD_CLASSES}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

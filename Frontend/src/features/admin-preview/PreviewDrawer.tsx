import type { ReactNode } from 'react';

import { Drawer } from '../../shared/overlays';

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Detail-drawers (Assignments/Audit) чуть шире формы создания — 'md' вместо 'sm'. */
  width?: 'form' | 'detail';
}

/**
 * Overlay-drawer поверх layout: создание сущности (Users) и detail-панели
 * (Assignments/Audit) — тонкая обёртка над общим `Drawer` из shared overlay
 * system (portal, overlay stack, focus trap/return, scroll lock, responsive
 * fullscreen на mobile). Внешний API не менялся — вызывающие страницы не трогали.
 */
export function PreviewDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'form',
}: PreviewDrawerProps): JSX.Element {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      description={description}
      size={width === 'detail' ? 'md' : 'sm'}
      footer={footer}
    >
      {children}
    </Drawer>
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

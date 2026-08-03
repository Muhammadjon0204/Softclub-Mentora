import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface PopoverProps {
  trigger: (props: { onClick: () => void; ref: (node: HTMLButtonElement | null) => void; isOpen: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
}

/**
 * Общий примитив выпадающей панели: BranchContextSelector и ProfileMenu строятся
 * поверх него. Правила из раздела 30 промпта — все обязательны:
 *   - Escape, клик вне панели и выбор пункта закрывают панель и возвращают
 *     фокус на trigger — один путь (`close`), а не три отдельных;
 *   - `aria-expanded` на trigger обновляется синхронно с состоянием.
 *
 * Радиус, ширина, padding и тень панели НЕ фиксированы здесь: потребители
 * с разными визуальными требованиями (например, ProfileMenu vs
 * BranchContextSelector) конфликтовали бы через один и тот же CSS-класс,
 * а порядок утилит в className не гарантирует, чья версия победит в
 * итоговом stylesheet. Каждый потребитель задаёт их явно через `panelClassName`.
 */
export function Popover({ trigger, children, align = 'left', panelClassName = '' }: PopoverProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = (): void => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) === true) return;
      if (triggerRef.current?.contains(target) === true) return;
      close();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      {trigger({
        isOpen,
        ref: (node) => {
          triggerRef.current = node;
        },
        onClick: () => {
          setIsOpen((current) => !current);
        },
      })}
      {isOpen ? (
        <div
          ref={panelRef}
          className={`absolute z-40 mt-2 animate-scale-in border border-line bg-surface ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName}`}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

interface MenuItemProps {
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  destructive?: boolean;
}

export function MenuItem({ onClick, children, icon, destructive = false }: MenuItemProps): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-control-sm px-2.5 py-2 text-left text-sm transition hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none ${destructive ? 'text-danger' : 'text-ink'}`}
    >
      {icon !== undefined ? (
        <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

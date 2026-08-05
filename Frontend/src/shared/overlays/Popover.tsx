import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { computeFloatingPosition } from './floatingPosition';
import type { FloatingAlign, FloatingPlacement } from './floatingPosition';
import { OverlayPortal } from './OverlayPortal';
import { OVERLAY_Z_INDEX } from './overlayZIndex';
import { useOverlayPresence } from './useOverlayPresence';
import { useOverlayStack } from './useOverlayStack';
import { useRestoreFocus } from './useRestoreFocus';

export interface PopoverTriggerRenderProps {
  onClick: () => void;
  ref: (node: HTMLButtonElement | null) => void;
  isOpen: boolean;
}

export interface PopoverProps {
  trigger: (props: PopoverTriggerRenderProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  placement?: FloatingPlacement;
  /** `left`/`right` — legacy alias для `start`/`end` (панель под левым/правым краем trigger). */
  align?: FloatingAlign | 'left' | 'right';
  offset?: number;
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
}

const EXIT_MS = 130;
const VIEWPORT_PADDING = 8;

function normalizeAlign(align: FloatingAlign | 'left' | 'right'): FloatingAlign {
  if (align === 'left') return 'start';
  if (align === 'right') return 'end';
  return align;
}

/**
 * Общий примитив floating-панели: ProfileMenu, ActionMenu, локальные dropdown
 * строятся поверх него. Панель рендерится через OverlayPortal (не обрезается
 * `overflow:hidden` Card), позиционируется относительно trigger с flip/clamp,
 * закрывается по Escape (через overlay stack) и клику вне панели, возвращает
 * фокус на trigger при закрытии.
 */
export function Popover({
  trigger,
  children,
  placement = 'bottom',
  align = 'start',
  offset = 8,
  panelClassName = '',
  open: controlledOpen,
  onOpenChange,
  closeOnEscape = true,
}: PopoverProps): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (controlledOpen === undefined) setUncontrolledOpen(next);
    },
    [controlledOpen, onOpenChange],
  );
  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const triggerElRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const { mounted, visible } = useOverlayPresence(isOpen, EXIT_MS);
  useOverlayStack({ type: 'popover', open: isOpen, closeOnEscape, onClose: close });
  useRestoreFocus(isOpen);

  const normalizedAlign = normalizeAlign(align);

  const recompute = useCallback((): void => {
    const triggerEl = triggerElRef.current;
    const panelEl = panelRef.current;
    if (triggerEl === null || panelEl === null) return;
    const triggerRect = triggerEl.getBoundingClientRect();
    const panelRect = panelEl.getBoundingClientRect();
    const result = computeFloatingPosition({
      trigger: { top: triggerRect.top, left: triggerRect.left, width: triggerRect.width, height: triggerRect.height },
      panel: { width: panelRect.width, height: panelRect.height },
      placement,
      align: normalizedAlign,
      offset,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      padding: VIEWPORT_PADDING,
    });
    setCoords({ top: result.top, left: result.left });
  }, [placement, normalizedAlign, offset]);

  useLayoutEffect(() => {
    if (!mounted) {
      setCoords(null);
      return;
    }
    recompute();
  }, [mounted, recompute, children]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleReposition(): void {
      recompute();
    }
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) === true) return;
      if (triggerElRef.current?.contains(target) === true) return;
      close();
    }

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, recompute, close]);

  return (
    <>
      {trigger({
        isOpen,
        ref: (node) => {
          triggerElRef.current = node;
        },
        onClick: () => {
          setOpen(!isOpen);
        },
      })}
      {mounted ? (
        <OverlayPortal>
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords === null ? 'hidden' : 'visible',
              zIndex: OVERLAY_Z_INDEX.popover,
            }}
            className={`border border-line bg-surface transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
              visible ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'
            } ${panelClassName}`}
          >
            {children(close)}
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}

interface MenuItemProps {
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  destructive?: boolean;
}

/** Пункт произвольного Popover-меню (не участвует в roving keyboard nav ActionMenu). */
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

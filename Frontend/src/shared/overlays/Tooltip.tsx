import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { computeFloatingPosition } from './floatingPosition';
import type { FloatingPlacement } from './floatingPosition';
import { OverlayPortal } from './OverlayPortal';
import { OVERLAY_Z_INDEX } from './overlayZIndex';
import { useOverlayPresence } from './useOverlayPresence';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: FloatingPlacement;
  /** Не показывать вовсе — например, когда текст не обрезан и подсказка не нужна. */
  disabled?: boolean;
}

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 80;
const EXIT_MS = 120;
const VIEWPORT_PADDING = 8;
const OFFSET = 8;

/**
 * Общий UI Tooltip: portal, position:fixed, collision detection, pointer-events
 * none, hover+focus, задержка открытия/закрытия (раздел 19 промпта). Не путать
 * с `ChartTooltipPortal` — у графиков своя специализированная mouse-driven логика.
 */
export function Tooltip({ content, children, placement = 'top', disabled = false }: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const openTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const id = useId();

  const { mounted, visible } = useOverlayPresence(open, EXIT_MS);

  function clearTimers(): void {
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function scheduleOpen(): void {
    if (disabled) return;
    clearTimers();
    openTimeoutRef.current = window.setTimeout(() => {
      setOpen(true);
    }, OPEN_DELAY_MS);
  }

  function scheduleClose(): void {
    clearTimers();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }

  useEffect(() => clearTimers, []);

  useLayoutEffect(() => {
    if (!mounted) {
      setCoords(null);
      return;
    }
    const wrapper = wrapperRef.current;
    const panel = panelRef.current;
    if (wrapper === null || panel === null) return;
    const triggerRect = wrapper.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const result = computeFloatingPosition({
      trigger: { top: triggerRect.top, left: triggerRect.left, width: triggerRect.width, height: triggerRect.height },
      panel: { width: panelRect.width, height: panelRect.height },
      placement,
      align: 'center',
      offset: OFFSET,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      padding: VIEWPORT_PADDING,
    });
    setCoords({ top: result.top, left: result.left });
  }, [mounted, placement, content]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={scheduleClose}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {mounted ? (
        <OverlayPortal>
          <div
            ref={panelRef}
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords === null ? 'hidden' : 'visible',
              zIndex: OVERLAY_Z_INDEX.tooltip,
              pointerEvents: 'none',
            }}
            className={`max-w-[280px] rounded-[9px] border border-line bg-ink px-2.5 py-2 text-center text-[12px] leading-[16px] text-white shadow-popover transition-opacity motion-reduce:transition-none ${
              visible ? 'duration-150 ease-out opacity-100' : 'duration-100 ease-in opacity-0'
            }`}
          >
            {content}
          </div>
        </OverlayPortal>
      ) : null}
    </span>
  );
}

/** Показывать tooltip только когда текст реально обрезан (`scrollWidth > clientWidth`). */
export function useIsTruncated(ref: RefObject<HTMLElement>, deps: unknown[] = []): boolean {
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      setIsTruncated(false);
      return;
    }
    setIsTruncated(element.scrollWidth > element.clientWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчитываем по внешним deps вызывающего компонента
  }, deps);

  return isTruncated;
}

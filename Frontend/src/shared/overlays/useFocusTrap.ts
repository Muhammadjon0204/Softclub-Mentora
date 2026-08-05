import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null,
  );
}

/**
 * Удерживает Tab/Shift+Tab внутри контейнера — только для topmost blocking
 * overlay (раздел 8 промпта). Popover/ActionMenu focus trap не используют.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (container === null) return undefined;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Tab' || container === null) return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last || !container.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, containerRef]);
}

/** Фокус на initialFocusRef → первый focusable → сам container (tabIndex=-1). */
export function focusInitialElement(container: HTMLElement, initialFocusRef?: RefObject<HTMLElement>): void {
  if (initialFocusRef?.current !== null && initialFocusRef?.current !== undefined) {
    initialFocusRef.current.focus();
    return;
  }
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[0].focus();
    return;
  }
  container.focus();
}

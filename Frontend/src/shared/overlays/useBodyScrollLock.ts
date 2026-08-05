import { useEffect } from 'react';

let lockCount = 0;
let originalOverflow: string | null = null;
let originalPaddingRight: string | null = null;

function lockBodyScroll(): void {
  if (lockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const currentPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight || '0');
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
  }
  lockCount += 1;
}

function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow ?? '';
    document.body.style.paddingRight = originalPaddingRight ?? '';
    originalOverflow = null;
    originalPaddingRight = null;
  }
}

/**
 * Блокирует scroll страницы с reference counting: если Drawer уже заблокировал
 * body и поверх открывается ConfirmDialog, закрытие ConfirmDialog не разблокирует
 * body — оно снимается только когда закрывается последний blocking overlay.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [active]);
}

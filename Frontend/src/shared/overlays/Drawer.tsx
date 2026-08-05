import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

import { DrawerBody } from './DrawerBody';
import { DrawerFooter } from './DrawerFooter';
import { DrawerHeader } from './DrawerHeader';
import { OverlayPortal } from './OverlayPortal';
import { OVERLAY_Z_INDEX } from './overlayZIndex';
import { useBodyScrollLock } from './useBodyScrollLock';
import { focusInitialElement, useFocusTrap } from './useFocusTrap';
import { useOverlayPresence } from './useOverlayPresence';
import { useOverlayStack } from './useOverlayStack';
import { useRestoreFocus } from './useRestoreFocus';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: DrawerSize;
  side?: 'right';
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  preventClose?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
}

const DRAWER_SIZE_CLASSES: Record<DrawerSize, string> = {
  sm: 'sm:w-[min(420px,calc(100vw-24px))]',
  md: 'sm:w-[min(500px,calc(100vw-24px))]',
  lg: 'sm:w-[min(600px,calc(100vw-24px))]',
  xl: 'sm:w-[min(740px,calc(100vw-24px))]',
};

const EXIT_MS = 180;

/**
 * Единый правосторонний Drawer для создания/редактирования/просмотра деталей.
 * На mobile — fullscreen (100dvh, без радиуса); на desktop — фиксированная
 * ширина по `size`, ограниченная viewport (раздел 12 промпта).
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  closeOnEscape = true,
  closeOnBackdrop = true,
  preventClose = false,
  initialFocusRef,
  children,
  footer,
  headerActions,
  className = '',
}: DrawerProps): JSX.Element | null {
  const { mounted, visible } = useOverlayPresence(open, EXIT_MS);
  const { isTopmost } = useOverlayStack({
    type: 'drawer',
    open,
    closeOnEscape: closeOnEscape && !preventClose,
    onClose: () => onOpenChange(false),
  });

  useBodyScrollLock(mounted);
  useRestoreFocus(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  // `mounted` в условии обязателен: панель коммитится в DOM на один тик позже, чем `open`
  // становится true (через useOverlayPresence) — без него эффект не перезапускается, когда
  // panelRef уже реально указывает на DOM-узел.
  useFocusTrap(panelRef, mounted && open && isTopmost);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!mounted || !open || panelRef.current === null) return;
    focusInitialElement(panelRef.current, initialFocusRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- фокусируем только при появлении панели в DOM, не на каждый ре-рендер
  }, [mounted]);

  if (!mounted) return null;

  function handleBackdropClick(): void {
    if (preventClose || !closeOnBackdrop) return;
    onOpenChange(false);
  }

  return (
    <OverlayPortal>
      <div className="fixed inset-0" style={{ zIndex: OVERLAY_Z_INDEX.drawer }}>
        <div
          role="presentation"
          onClick={handleBackdropClick}
          className={`absolute inset-0 bg-[rgba(15,23,42,0.36)] backdrop-blur-[1.5px] transition-opacity motion-reduce:transition-none ${
            visible ? 'duration-[170ms] ease-out opacity-100' : 'duration-150 ease-in opacity-0'
          }`}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description !== undefined ? descriptionId : undefined}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
          }}
          className={`absolute inset-y-0 right-0 flex h-[100dvh] w-screen flex-col border-l border-line bg-surface shadow-[0_4px_10px_rgba(16,24,40,0.05),0_24px_60px_rgba(20,28,58,0.14)] transition-[opacity,transform] motion-reduce:transition-none motion-reduce:transform-none sm:rounded-l-[18px] ${
            visible
              ? 'duration-[220ms] ease-out opacity-100 translate-x-0'
              : 'duration-[180ms] ease-in opacity-[0.98] translate-x-5'
          } ${DRAWER_SIZE_CLASSES[size]} ${className}`}
        >
          <DrawerHeader
            titleId={titleId}
            descriptionId={description !== undefined ? descriptionId : undefined}
            title={title}
            description={description}
            headerActions={headerActions}
            onClose={preventClose ? undefined : () => onOpenChange(false)}
          />
          <DrawerBody>{children}</DrawerBody>
          {footer !== undefined ? <DrawerFooter>{footer}</DrawerFooter> : null}
        </div>
      </div>
    </OverlayPortal>
  );
}

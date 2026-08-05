import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

import { IconButton } from '../ui/Button';
import { OverlayPortal } from './OverlayPortal';
import { OVERLAY_Z_INDEX } from './overlayZIndex';
import { useBodyScrollLock } from './useBodyScrollLock';
import { focusInitialElement, useFocusTrap } from './useFocusTrap';
import { useOverlayPresence } from './useOverlayPresence';
import { useOverlayStack } from './useOverlayStack';
import { useRestoreFocus } from './useRestoreFocus';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: ModalSize;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  /** Блокирует Escape/backdrop/X-кнопку — используется во время submitting. */
  preventClose?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  children: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

const MODAL_SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'w-[min(420px,calc(100vw-24px))]',
  md: 'w-[min(500px,calc(100vw-24px))]',
  lg: 'w-[min(640px,calc(100vw-24px))]',
};

const EXIT_MS = 150;

/**
 * Общий Modal для подтверждений, коротких операций и небольших форм (не для
 * многошаговых форм — для этого Drawer). Backdrop + panel рендерятся через
 * OverlayPortal, поэтому overflow:hidden родительской Card их не обрезает.
 */
export function Modal({
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
  icon,
  ariaLabel,
  className = '',
}: ModalProps): JSX.Element | null {
  const { mounted, visible } = useOverlayPresence(open, EXIT_MS);
  const { isTopmost } = useOverlayStack({
    type: 'modal',
    open,
    closeOnEscape: closeOnEscape && !preventClose,
    onClose: () => onOpenChange(false),
  });

  useBodyScrollLock(mounted);
  useRestoreFocus(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  // `mounted` в условии обязателен: панель коммитится в DOM на один тик позже, чем `open`
  // становится true (через useOverlayPresence) — без него `active`/deps не меняются между
  // рендерами и эффект не перезапускается, когда panelRef уже реально указывает на DOM-узел.
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
      <div
        className="fixed inset-0 flex items-center justify-center p-3"
        style={{ zIndex: OVERLAY_Z_INDEX.modal }}
      >
        <div
          role="presentation"
          onClick={handleBackdropClick}
          className={`absolute inset-0 bg-[rgba(15,23,42,0.36)] backdrop-blur-[1.5px] transition-opacity motion-reduce:transition-none ${
            visible ? 'duration-[180ms] ease-out opacity-100' : 'duration-150 ease-in opacity-0'
          }`}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description !== undefined ? descriptionId : undefined}
          aria-label={ariaLabel}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
          }}
          className={`relative flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_4px_10px_rgba(16,24,40,0.05),0_24px_60px_rgba(20,28,58,0.14)] transition-[opacity,transform] motion-reduce:transition-none motion-reduce:transform-none ${
            visible
              ? 'duration-[190ms] ease-out opacity-100 translate-y-0 scale-100'
              : 'duration-150 ease-in opacity-0 translate-y-2 scale-[0.985]'
          } ${MODAL_SIZE_CLASSES[size]} ${className}`}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 py-5 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              {icon !== undefined ? (
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center">
                  {icon}
                </span>
              ) : null}
              <div className="min-w-0">
                <h2 id={titleId} className="text-[17px] font-semibold leading-[24px] text-ink">
                  {title}
                </h2>
                {description !== undefined ? (
                  <p id={descriptionId} className="mt-1 text-[13px] leading-[19px] text-ink-secondary">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            {!preventClose ? (
              <IconButton
                label="Закрыть"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                <X className="h-[17px] w-[17px]" aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">{children}</div>

          {footer !== undefined ? (
            <div className="shrink-0 border-t border-divider bg-surface-muted px-5 py-4 sm:px-6">{footer}</div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}

import { OverlayPortal } from './OverlayPortal';
import { Toast } from './Toast';
import { useToastContext } from './ToastProvider';
import { OVERLAY_Z_INDEX } from './overlayZIndex';

/**
 * Единый контейнер toast-стека — монтируется один раз через `ToastProvider`.
 * Сверху по центру (запрос 2026-10-12): справа он перекрывал кнопки в шапке Drawer и
 * панели действий, а по центру над контентом не мешает ничему и сразу попадает в поле
 * зрения. Новые toast опускаются сверху — старые не прыгают благодаря transition.
 */
export function ToastViewport(): JSX.Element | null {
  const { toasts } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <OverlayPortal>
      <div
        style={{ zIndex: OVERLAY_Z_INDEX.toast }}
        className="pointer-events-none fixed left-1/2 top-3 flex w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 flex-col items-stretch gap-2 sm:top-5"
      >
        {toasts.map((entry) => (
          <Toast key={entry.id} entry={entry} />
        ))}
      </div>
    </OverlayPortal>
  );
}

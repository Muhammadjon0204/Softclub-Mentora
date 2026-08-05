import { OverlayPortal } from './OverlayPortal';
import { Toast } from './Toast';
import { useToastContext } from './ToastProvider';
import { OVERLAY_Z_INDEX } from './overlayZIndex';

/**
 * Единый контейнер toast-стека — монтируется один раз через `ToastProvider`.
 * top-right на desktop с отступом от Topbar, top full-width на mobile
 * (раздел 20/23 промпта). Новые toast добавляются снизу стека и всплывают
 * вверх — старые не прыгают резко благодаря transition на каждом Toast.
 */
export function ToastViewport(): JSX.Element | null {
  const { toasts } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <OverlayPortal>
      <div
        style={{ zIndex: OVERLAY_Z_INDEX.toast }}
        className="pointer-events-none fixed left-3 right-3 top-3 flex flex-col gap-2 sm:left-auto sm:right-6 sm:top-[84px] sm:w-[380px]"
      >
        {toasts.map((entry) => (
          <Toast key={entry.id} entry={entry} />
        ))}
      </div>
    </OverlayPortal>
  );
}

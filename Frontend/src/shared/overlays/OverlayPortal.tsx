import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

const OVERLAY_ROOT_ID = 'mentora-overlay-root';

let sharedRoot: HTMLElement | null = null;
let refCount = 0;
let createdBySystem = false;
let pendingRemoval: number | null = null;

/**
 * SSR-safe, идемпотентно: возвращает существующий #mentora-overlay-root или
 * создаёт один на всё приложение. Не трогает `refCount` — безопасно вызывать
 * из `useState`-инициализатора (React может вызвать его дважды в StrictMode).
 */
function ensureOverlayRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (sharedRoot !== null) return sharedRoot;

  const existing = document.getElementById(OVERLAY_ROOT_ID);
  if (existing !== null) {
    sharedRoot = existing;
    createdBySystem = false;
    return sharedRoot;
  }

  const created = document.createElement('div');
  created.id = OVERLAY_ROOT_ID;
  document.body.appendChild(created);
  sharedRoot = created;
  createdBySystem = true;
  return sharedRoot;
}

/**
 * Общий portal для всех overlays (Modal/Drawer/ConfirmDialog/Popover/ActionMenu/Tooltip/
 * ToastViewport) — рендерит children в единый `#mentora-overlay-root` в конце `<body>`,
 * так что ничей `overflow: hidden`/`overflow: auto` на родительской Card их не обрезает.
 *
 * Root вычисляется синхронно в `useState`-инициализаторе (а не в `useEffect`) —
 * иначе children рендерились бы на один цикл эффектов позже, чем открывающий их
 * overlay помечает себя `mounted`, и любой код, ожидающий DOM-узел сразу после
 * этого (initial focus, позиционирование Popover) читал бы ещё пустой ref.
 */
export function OverlayPortal({ children }: { children: ReactNode }): ReactNode {
  const [root] = useState<HTMLElement | null>(() => ensureOverlayRoot());

  useEffect(() => {
    // Отменяем отложенное удаление root, если оно было запланировано предыдущим unmount —
    // покрывает и React StrictMode (dev-only mount→cleanup→mount на каждом первом монтировании),
    // и обычный кейс «закрыли один overlay и тут же открыли следующий».
    if (pendingRemoval !== null) {
      window.clearTimeout(pendingRemoval);
      pendingRemoval = null;
    }
    refCount += 1;

    return () => {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0 && sharedRoot !== null && createdBySystem) {
        pendingRemoval = window.setTimeout(() => {
          pendingRemoval = null;
          if (refCount === 0 && sharedRoot !== null && createdBySystem) {
            sharedRoot.remove();
            sharedRoot = null;
            createdBySystem = false;
          }
        }, 0);
      }
    };
  }, []);

  if (root === null) return null;
  return createPortal(children, root);
}

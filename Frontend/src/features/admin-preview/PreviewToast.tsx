import { useCallback } from 'react';

import { useToast } from '../../shared/overlays';

/**
 * @deprecated Совместимость: рендеринг теперь идёт через глобальный
 * `ToastViewport` (`shared/overlays/ToastProvider`, подключён в `main.tsx`).
 * `usePreviewToast`/`<PreviewToast>` остаются как тонкая обёртка — существующие
 * страницы (Users/Categories/Branches/...) продолжают вызывать `showToast(text)`
 * без изменений. Для нового кода используйте `useToast()` напрямую.
 */
export function usePreviewToast(): [string | null, (message: string) => void] {
  const toast = useToast();

  const show = useCallback(
    (message: string) => {
      toast.info(message);
    },
    [toast],
  );

  return [null, show];
}

/** Рендеринг toast теперь глобальный (`ToastViewport`) — этот компонент ничего не рендерит. */
export function PreviewToast(_props: { message: string | null }): null {
  return null;
}

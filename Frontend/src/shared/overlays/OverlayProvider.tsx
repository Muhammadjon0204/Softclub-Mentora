import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { pushOverlay, removeOverlay, topmostOverlay, updateOverlayInPlace } from './overlayStack';
import type { OverlayRegistration } from './overlayStack';

interface OverlayContextValue {
  stack: OverlayRegistration[];
  register: (entry: OverlayRegistration) => void;
  update: (entry: OverlayRegistration) => void;
  unregister: (id: string) => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

/**
 * Единственный provider на всё приложение: держит стек открытых overlays и
 * обрабатывает Escape централизованно — закрывает только topmost (раздел 4
 * промпта). Порядок в стеке — порядок открытия, поэтому вложенный overlay
 * (ConfirmDialog поверх Drawer) всегда оказывается выше своего родителя.
 */
export function OverlayProvider({ children }: { children: ReactNode }): JSX.Element {
  const [stack, setStack] = useState<OverlayRegistration[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const register = useCallback((entry: OverlayRegistration) => {
    setStack((current) => pushOverlay(current, entry));
  }, []);

  const update = useCallback((entry: OverlayRegistration) => {
    setStack((current) => updateOverlayInPlace(current, entry));
  }, []);

  const unregister = useCallback((id: string) => {
    setStack((current) => removeOverlay(current, id));
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      const top = topmostOverlay(stackRef.current);
      if (top === null || !top.closeOnEscape) return;
      event.stopPropagation();
      top.onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const value = useMemo<OverlayContextValue>(
    () => ({ stack, register, update, unregister }),
    [stack, register, update, unregister],
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlayContext(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (ctx === null) throw new Error('useOverlayContext должен использоваться внутри <OverlayProvider>');
  return ctx;
}

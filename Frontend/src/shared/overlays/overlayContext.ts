import { createContext, useContext } from 'react';

import type { OverlayRegistration } from './overlayStack';

/** Контекст стека overlays — отдельно от `OverlayProvider`, чтобы тот экспортировал только компонент. */
export interface OverlayContextValue {
  stack: OverlayRegistration[];
  register: (entry: OverlayRegistration) => void;
  update: (entry: OverlayRegistration) => void;
  unregister: (id: string) => void;
}

export const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlayContext(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (ctx === null) throw new Error('useOverlayContext должен использоваться внутри <OverlayProvider>');
  return ctx;
}

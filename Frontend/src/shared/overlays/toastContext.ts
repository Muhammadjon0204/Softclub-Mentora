import { createContext, useContext } from 'react';

import type { ToastEntry, ToastOptions, ToastVariant } from './ToastProvider';

/** Контекст тостов — отдельно от `ToastProvider`, чтобы тот экспортировал только компонент. */
export interface ToastContextValue {
  toasts: ToastEntry[];
  push: (variant: ToastVariant, message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error('useToastContext должен использоваться внутри <ToastProvider>');
  return ctx;
}

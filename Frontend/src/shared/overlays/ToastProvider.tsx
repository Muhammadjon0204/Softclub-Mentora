import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ToastViewport } from './ToastViewport';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
}

export interface ToastEntry extends ToastOptions {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
  dismissible: boolean;
  /** true во время exit-анимации — сам toast уже не в очереди, но ещё в DOM. */
  closing: boolean;
}

const TOAST_EXIT_MS = 170;

interface ToastContextValue {
  toasts: ToastEntry[];
  push: (variant: ToastVariant, message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4500,
  warning: 5500,
  error: 7000,
};

const MAX_VISIBLE_TOASTS = 3;

const ToastContext = createContext<ToastContextValue | null>(null);

interface TimerState {
  timeoutId: number | null;
  expiresAt: number;
  remaining: number;
}

/**
 * Единый ToastProvider на всё приложение. Countdown хранится по timestamp
 * (`expiresAt`/`remaining`), а не наивным `setTimeout` — это позволяет корректно
 * ставить таймер на паузу при hover/focus/скрытой вкладке и возобновлять с
 * оставшимся временем, а не с начала (раздел 20 промпта).
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<string, TimerState>>(new Map());

  /** Двухфазно: сперва помечает toast `closing` (запускает exit-анимацию), затем убирает из списка. */
  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer?.timeoutId !== null && timer !== undefined) {
      window.clearTimeout(timer.timeoutId);
    }
    timersRef.current.delete(id);
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const startTimer = useCallback(
    (id: string, duration: number) => {
      const timeoutId = window.setTimeout(() => {
        dismiss(id);
      }, duration);
      timersRef.current.set(id, { timeoutId, expiresAt: Date.now() + duration, remaining: duration });
    },
    [dismiss],
  );

  const pause = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer === undefined || timer.timeoutId === null) return;
    window.clearTimeout(timer.timeoutId);
    timersRef.current.set(id, { timeoutId: null, expiresAt: timer.expiresAt, remaining: Math.max(0, timer.expiresAt - Date.now()) });
  }, []);

  const resume = useCallback(
    (id: string) => {
      const timer = timersRef.current.get(id);
      if (timer === undefined || timer.timeoutId !== null) return;
      const timeoutId = window.setTimeout(() => {
        dismiss(id);
      }, timer.remaining);
      timersRef.current.set(id, { timeoutId, expiresAt: Date.now() + timer.remaining, remaining: timer.remaining });
    },
    [dismiss],
  );

  const push = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = options?.duration ?? DEFAULT_DURATION[variant];
      const entry: ToastEntry = {
        id,
        variant,
        message,
        duration,
        title: options?.title,
        action: options?.action,
        dismissible: options?.dismissible ?? true,
        closing: false,
      };

      setToasts((current) => {
        const next = [...current, entry];
        const overflow = next.length - MAX_VISIBLE_TOASTS;
        if (overflow > 0) {
          const dropped = next.splice(0, overflow);
          for (const droppedToast of dropped) {
            const timer = timersRef.current.get(droppedToast.id);
            if (timer?.timeoutId !== null && timer !== undefined) window.clearTimeout(timer.timeoutId);
            timersRef.current.delete(droppedToast.id);
          }
        }
        return next;
      });

      startTimer(id, duration);
      return id;
    },
    [startTimer],
  );

  // Скрытая вкладка приостанавливает все countdown — пользователь не видит toast, пока не вернётся.
  useEffect(() => {
    function handleVisibilityChange(): void {
      const ids = Array.from(timersRef.current.keys());
      if (document.hidden) {
        for (const id of ids) pause(id);
      } else {
        for (const id of ids) resume(id);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pause, resume]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        if (timer.timeoutId !== null) window.clearTimeout(timer.timeoutId);
      }
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toasts, push, dismiss, pause, resume }), [toasts, push, dismiss, pause, resume]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error('useToastContext должен использоваться внутри <ToastProvider>');
  return ctx;
}

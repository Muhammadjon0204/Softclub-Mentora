import { useMemo } from 'react';

import { useToastContext } from './ToastProvider';
import type { ToastOptions } from './ToastProvider';

export interface UseToastResult {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

/**
 * `const toast = useToast(); toast.success('Изменения сохранены');` —
 * единственный способ показать toast в приложении (раздел 20/29 промпта).
 */
export function useToast(): UseToastResult {
  const { push, dismiss } = useToastContext();

  return useMemo(
    () => ({
      success: (message: string, options?: ToastOptions) => push('success', message, options),
      error: (message: string, options?: ToastOptions) => push('error', message, options),
      warning: (message: string, options?: ToastOptions) => push('warning', message, options),
      info: (message: string, options?: ToastOptions) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss],
  );
}

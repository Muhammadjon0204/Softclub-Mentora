import { useCallback, useRef, useState } from 'react';

/** Локальный auto-dismiss toast для заглушек «функция будет подключена позже» — без глобального стора. */
export function usePreviewToast(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const show = useCallback((next: string) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setMessage(next);
    timeoutRef.current = window.setTimeout(() => {
      setMessage(null);
    }, 2400);
  }, []);

  return [message, show];
}

export function PreviewToast({ message }: { message: string | null }): JSX.Element | null {
  if (message === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-fade-in rounded-control border border-line bg-ink px-4 py-2.5 text-[13px] font-medium text-white shadow-popover"
    >
      {message}
    </div>
  );
}

import { useEffect, useState } from 'react';

/**
 * Текущее время, обновляемое раз в `intervalMs`. Пока вкладка скрыта, таймер стоит,
 * а при возвращении время сразу догоняется — фоновая вкладка не тратит батарею на секунды,
 * которых никто не видит.
 */
export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = (): void => {
      if (timer !== null) return;
      setNow(Date.now());
      timer = setInterval(() => { setNow(Date.now()); }, intervalMs);
    };
    const stop = (): void => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [intervalMs]);

  return now;
}

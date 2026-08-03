import { useCallback, useEffect, useRef, useState } from 'react';

export interface RateLimitCountdown {
  /** Сколько секунд осталось. 0 — отсчёт не идёт. */
  remaining: number;
  isActive: boolean;
  start: (seconds: number) => void;
  stop: () => void;
}

/** Обратный отсчёт по заголовку `Retry-After`: блокирует submit на N секунд. */
export function useRateLimitCountdown(): RateLimitCountdown {
  const [remaining, setRemaining] = useState(0);
  const deadlineRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    deadlineRef.current = 0;
    setRemaining(0);
  }, [clearTimer]);

  const start = useCallback(
    (seconds: number) => {
      clearTimer();

      if (seconds <= 0) {
        setRemaining(0);
        return;
      }

      deadlineRef.current = Date.now() + seconds * 1000;
      setRemaining(seconds);

      timerRef.current = window.setInterval(() => {
        const left = Math.ceil((deadlineRef.current - Date.now()) / 1000);
        if (left <= 0) {
          clearTimer();
          setRemaining(0);
          return;
        }
        setRemaining(left);
      }, 1000);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { remaining, isActive: remaining > 0, start, stop };
}

import { useCallback, useEffect, useRef } from 'react';

import type { FloatingTooltipPoint } from './floatingTooltipPosition';

const SMOOTHING = 0.21;
const SETTLE_THRESHOLD = 0.1;

/**
 * Плавное следование tooltip за целевой позицией без React re-render на
 * каждый pointermove (раздел 8–9 промпта): позиция применяется напрямую
 * через `style.transform` на ref, состояние живёт в refs, а не в useState.
 */
export function useFloatingChartTooltip(): {
  elementRef: React.RefObject<HTMLDivElement>;
  setTarget: (point: FloatingTooltipPoint, options?: { immediate?: boolean }) => void;
  reset: () => void;
} {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<FloatingTooltipPoint>({ x: 0, y: 0 });
  const currentRef = useRef<FloatingTooltipPoint | null>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mediaQuery.matches;
    const handleChange = (event: MediaQueryListEvent): void => {
      reducedMotionRef.current = event.matches;
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const applyTransform = useCallback((point: FloatingTooltipPoint): void => {
    if (elementRef.current !== null) {
      elementRef.current.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    }
  }, []);

  const stopLoop = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const step = useCallback((): void => {
    const current = currentRef.current;
    const target = targetRef.current;
    if (current === null) {
      currentRef.current = target;
      applyTransform(target);
      rafRef.current = null;
      return;
    }
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    if (Math.abs(dx) < SETTLE_THRESHOLD && Math.abs(dy) < SETTLE_THRESHOLD) {
      currentRef.current = target;
      applyTransform(target);
      rafRef.current = null;
      return;
    }
    const next = { x: current.x + dx * SMOOTHING, y: current.y + dy * SMOOTHING };
    currentRef.current = next;
    applyTransform(next);
    rafRef.current = requestAnimationFrame(step);
  }, [applyTransform]);

  const setTarget = useCallback(
    (point: FloatingTooltipPoint, options?: { immediate?: boolean }): void => {
      targetRef.current = point;
      const shouldSnap = currentRef.current === null || options?.immediate === true || reducedMotionRef.current;
      if (shouldSnap) {
        currentRef.current = point;
        applyTransform(point);
        stopLoop();
        return;
      }
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(step);
      }
    },
    [applyTransform, step, stopLoop],
  );

  const reset = useCallback((): void => {
    currentRef.current = null;
    stopLoop();
  }, [stopLoop]);

  useEffect(() => stopLoop, [stopLoop]);

  return { elementRef, setTarget, reset };
}

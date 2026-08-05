import { useEffect, useState } from 'react';

interface OverlayPresence {
  /** Должен ли overlay оставаться в DOM (true и во время exit-анимации). */
  mounted: boolean;
  /** Переключает visual-состояние на "открыто" — используется для CSS transition classes. */
  visible: boolean;
}

/**
 * Держит overlay смонтированным до конца exit-анимации вместо мгновенного
 * unmount по `open=false` (раздел 11/13 промпта). Двойной requestAnimationFrame
 * гарантирует, что браузер успевает отрисовать закрытое состояние перед тем,
 * как включится transition в открытое — иначе CSS transition не запустится.
 */
export function useOverlayPresence(open: boolean, exitDurationMs: number): OverlayPresence {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  // Корректировка state во время рендера (официально поддерживаемый React-паттерн,
  // см. "Adjusting state when a prop changes"), а не в эффекте: `mounted` обязан стать
  // true в ТОМ ЖЕ рендере, где `open` становится true. Если поднимать его из эффекта,
  // portal-контент (и всё, что от него синхронно зависит — initial focus, позиционирование
  // Popover) появляется на один render-цикл позже, чем можно было бы ожидать по `open`.
  if (open && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let timeout: number | undefined;

    if (open) {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      setVisible(false);
      timeout = window.setTimeout(() => {
        setMounted(false);
      }, exitDurationMs);
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [open, exitDurationMs]);

  return { mounted, visible };
}

import { useEffect, useRef } from 'react';

/**
 * Запоминает элемент, открывший overlay, и возвращает на него фокус после
 * закрытия. Если trigger успел исчезнуть из DOM — просто ничего не делает,
 * без ошибок (раздел 8 промпта, пункт 6).
 */
export function useRestoreFocus(active: boolean): void {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    return () => {
      const trigger = triggerRef.current;
      if (trigger !== null && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [active]);
}

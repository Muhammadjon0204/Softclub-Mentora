import { useEffect, useRef } from 'react';

import { useOverlayContext } from './OverlayProvider';
import type { OverlayType } from './overlayStack';

let overlayIdCounter = 0;
function generateOverlayId(type: OverlayType): string {
  overlayIdCounter += 1;
  return `${type}-${overlayIdCounter}`;
}

interface UseOverlayStackParams {
  type: OverlayType;
  open: boolean;
  closeOnEscape: boolean;
  onClose: () => void;
}

interface UseOverlayStackResult {
  isTopmost: boolean;
  depth: number;
}

/**
 * Регистрирует overlay-инстанс в общем стеке, пока он открыт. `onClose`
 * читается через ref на каждый вызов — сам overlay не нужно перерегистрировать
 * при каждом ре-рендере родителя (иначе он бы каждый раз прыгал в конец стека).
 */
export function useOverlayStack({ type, open, closeOnEscape, onClose }: UseOverlayStackParams): UseOverlayStackResult {
  const { stack, register, update, unregister } = useOverlayContext();

  const idRef = useRef<string | null>(null);
  if (idRef.current === null) idRef.current = generateOverlayId(type);
  const id = idRef.current;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    register({ id, type, closeOnEscape, onClose: () => onCloseRef.current() });
    return () => {
      unregister(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose обновляется через ref, чтобы не пересоздавать регистрацию
  }, [open, type, id, register, unregister]);

  useEffect(() => {
    if (!open) return;
    update({ id, type, closeOnEscape, onClose: () => onCloseRef.current() });
  }, [closeOnEscape, open, type, id, update]);

  const index = stack.findIndex((entry) => entry.id === id);
  const isTopmost = index !== -1 && index === stack.length - 1;

  return { isTopmost, depth: index === -1 ? 0 : index };
}

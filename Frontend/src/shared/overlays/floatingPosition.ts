export type FloatingPlacement = 'top' | 'bottom' | 'left' | 'right';
export type FloatingAlign = 'start' | 'center' | 'end';

export interface FloatingRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface FloatingSize {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

const OPPOSITE_PLACEMENT: Record<FloatingPlacement, FloatingPlacement> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

function placeAt(trigger: FloatingRect, panel: FloatingSize, placement: FloatingPlacement, align: FloatingAlign, offset: number): {
  top: number;
  left: number;
} {
  let top = 0;
  let left = 0;

  if (placement === 'bottom') top = trigger.top + trigger.height + offset;
  else if (placement === 'top') top = trigger.top - offset - panel.height;
  else if (placement === 'right') left = trigger.left + trigger.width + offset;
  else left = trigger.left - offset - panel.width;

  if (placement === 'bottom' || placement === 'top') {
    if (align === 'start') left = trigger.left;
    else if (align === 'end') left = trigger.left + trigger.width - panel.width;
    else left = trigger.left + trigger.width / 2 - panel.width / 2;
  } else {
    if (align === 'start') top = trigger.top;
    else if (align === 'end') top = trigger.top + trigger.height - panel.height;
    else top = trigger.top + trigger.height / 2 - panel.height / 2;
  }

  return { top, left };
}

/**
 * Позиционирование floating-панели (Popover/ActionMenu/Tooltip) относительно
 * trigger-элемента: предпочтительная сторона, flip на противоположную при
 * коллизии с viewport, финальный clamp в границы экрана (раздел 17 промпта).
 */
export function computeFloatingPosition(params: {
  trigger: FloatingRect;
  panel: FloatingSize;
  placement: FloatingPlacement;
  align: FloatingAlign;
  offset: number;
  viewport: ViewportSize;
  padding: number;
}): { top: number; left: number; placement: FloatingPlacement } {
  const { trigger, panel, placement, align, offset, viewport, padding } = params;

  let finalPlacement = placement;
  let point = placeAt(trigger, panel, finalPlacement, align, offset);

  const overflowsBottom = point.top + panel.height + padding > viewport.height;
  const overflowsTop = point.top < padding;
  const overflowsRight = point.left + panel.width + padding > viewport.width;
  const overflowsLeft = point.left < padding;

  if ((finalPlacement === 'bottom' && overflowsBottom) || (finalPlacement === 'top' && overflowsTop)) {
    finalPlacement = OPPOSITE_PLACEMENT[finalPlacement];
    point = placeAt(trigger, panel, finalPlacement, align, offset);
  } else if ((finalPlacement === 'right' && overflowsRight) || (finalPlacement === 'left' && overflowsLeft)) {
    finalPlacement = OPPOSITE_PLACEMENT[finalPlacement];
    point = placeAt(trigger, panel, finalPlacement, align, offset);
  }

  const left = Math.min(Math.max(point.left, padding), Math.max(padding, viewport.width - panel.width - padding));
  const top = Math.min(Math.max(point.top, padding), Math.max(padding, viewport.height - panel.height - padding));

  return { top, left, placement: finalPlacement };
}

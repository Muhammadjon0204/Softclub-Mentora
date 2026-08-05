export interface FloatingTooltipPoint {
  x: number;
  y: number;
}

export type FloatingTooltipPlacement = 'left' | 'right' | 'top' | 'bottom';

export type FloatingTooltipStrategy = 'cursor' | 'radial' | 'anchor';

interface FloatingTooltipSize {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Направление от центра donut к активной точке — сторона размещения
 * выбирается по доминирующей оси (раздел 5 промпта): левый сегмент → tooltip
 * уходит влево, верхний → вверх и т.д.
 */
export function getRadialAnchorPosition(
  center: FloatingTooltipPoint,
  anchor: FloatingTooltipPoint,
): { placement: FloatingTooltipPlacement; anchor: FloatingTooltipPoint } {
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const normalX = dx / length;
  const normalY = dy / length;
  const placement: FloatingTooltipPlacement =
    Math.abs(normalX) >= Math.abs(normalY) ? (normalX >= 0 ? 'right' : 'left') : normalY >= 0 ? 'bottom' : 'top';
  return { placement, anchor };
}

/** Курсор как anchor, предпочтительная сторона — вниз-вправо (стандартное поведение). */
export function getCursorTooltipPosition(
  clientX: number,
  clientY: number,
): { placement: FloatingTooltipPlacement; anchor: FloatingTooltipPoint } {
  return { placement: 'bottom', anchor: { x: clientX, y: clientY } };
}

/** Верхний левый угол tooltip для anchor+placement+offset, без учёта коллизий с viewport. */
export function placeTooltipAt(
  anchor: FloatingTooltipPoint,
  placement: FloatingTooltipPlacement,
  size: FloatingTooltipSize,
  offset: number,
): FloatingTooltipPoint {
  switch (placement) {
    case 'left':
      return { x: anchor.x - offset - size.width, y: anchor.y - size.height / 2 };
    case 'right':
      return { x: anchor.x + offset, y: anchor.y - size.height / 2 };
    case 'top':
      return { x: anchor.x - size.width / 2, y: anchor.y - offset - size.height };
    case 'bottom':
    default:
      return { x: anchor.x - size.width / 2, y: anchor.y + offset };
  }
}

const OPPOSITE_PLACEMENT: Record<FloatingTooltipPlacement, FloatingTooltipPlacement> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

/**
 * Если предпочтительная сторона выходит за viewport — переставляет tooltip
 * на противоположную сторону от anchor (раздел 6 промпта, шаги 3–6).
 */
export function flipTooltipPosition(
  anchor: FloatingTooltipPoint,
  placement: FloatingTooltipPlacement,
  size: FloatingTooltipSize,
  offset: number,
  viewport: ViewportSize,
  padding: number,
): { placement: FloatingTooltipPlacement; point: FloatingTooltipPoint } {
  let finalPlacement = placement;
  let point = placeTooltipAt(anchor, finalPlacement, size, offset);

  const overflowsRight = point.x + size.width + padding > viewport.width;
  const overflowsLeft = point.x < padding;
  const overflowsBottom = point.y + size.height + padding > viewport.height;
  const overflowsTop = point.y < padding;

  if ((finalPlacement === 'right' && overflowsRight) || (finalPlacement === 'left' && overflowsLeft)) {
    finalPlacement = OPPOSITE_PLACEMENT[finalPlacement];
    point = placeTooltipAt(anchor, finalPlacement, size, offset);
  } else if ((finalPlacement === 'bottom' && overflowsBottom) || (finalPlacement === 'top' && overflowsTop)) {
    finalPlacement = OPPOSITE_PLACEMENT[finalPlacement];
    point = placeTooltipAt(anchor, finalPlacement, size, offset);
  }

  return { placement: finalPlacement, point };
}

/** Финальный жёсткий clamp к границам viewport (раздел 6, шаг 7) — tooltip ограничен экраном, не card. */
export function clampTooltipToViewport(
  point: FloatingTooltipPoint,
  size: FloatingTooltipSize,
  viewport: ViewportSize,
  padding: number,
): FloatingTooltipPoint {
  return {
    x: Math.min(Math.max(point.x, padding), Math.max(padding, viewport.width - size.width - padding)),
    y: Math.min(Math.max(point.y, padding), Math.max(padding, viewport.height - size.height - padding)),
  };
}

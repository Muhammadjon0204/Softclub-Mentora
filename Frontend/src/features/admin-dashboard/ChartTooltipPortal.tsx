import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

import { OVERLAY_Z_INDEX } from '../../shared/overlays/overlayZIndex';
import {
  clampTooltipToViewport,
  flipTooltipPosition,
  getCursorTooltipPosition,
  getRadialAnchorPosition,
} from './floatingTooltipPosition';
import type { FloatingTooltipPlacement, FloatingTooltipPoint, FloatingTooltipStrategy } from './floatingTooltipPosition';
import { useFloatingChartTooltip } from './useFloatingChartTooltip';

/** Выше карточек, topbar, dropdown и popover — tooltip обязан быть на самом верху; значение берётся из общей overlay z-index шкалы (раздел 6 промпта). */
const CHART_TOOLTIP_Z_INDEX: number = OVERLAY_Z_INDEX.chartTooltip;
const VIEWPORT_PADDING = 14;
const DEFAULT_OFFSET = 16;
const HIDE_DELAY_MS = 70;

interface ChartTooltipPortalProps {
  visible: boolean;
  /** Viewport-координаты (clientX/clientY или chartRect.left + coordinate.x). */
  anchor: FloatingTooltipPoint | null;
  strategy: FloatingTooltipStrategy;
  /** Обязателен для strategy="radial" — центр donut в viewport-координатах. */
  centerAnchor?: FloatingTooltipPoint | null;
  /** Для strategy="anchor" (legend) — предпочтительная сторона перед collision detection. */
  preferredPlacement?: FloatingTooltipPlacement;
  offset?: number;
  /** Вызывается на scroll, пока tooltip виден с mouse-driven стратегией (cursor/radial) — курсор мог уйти с элемента. */
  onDismiss?: () => void;
  children: ReactNode;
}

/**
 * Общая floating-tooltip система для графиков Dashboard (раздел 2, 14
 * промпта). Рендерится в document.body через portal — не зависит от
 * `overflow: hidden` на ChartCard/Card, которое иначе обрезает любой
 * position:absolute tooltip у края карточки. position:fixed +
 * translate3d, collision detection и smoothing общие для всех стратегий;
 * payload/anchor-логика остаётся в конкретном графике.
 */
export function ChartTooltipPortal({
  visible,
  anchor,
  strategy,
  centerAnchor = null,
  preferredPlacement,
  offset = DEFAULT_OFFSET,
  onDismiss,
  children,
}: ChartTooltipPortalProps): JSX.Element | null {
  const { elementRef, setTarget, reset } = useFloatingChartTooltip();
  const [mounted, setMounted] = useState(visible);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setMounted(true);
      return;
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setMounted(false);
      reset();
    }, HIDE_DELAY_MS);
    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [visible, reset]);

  const recompute = useCallback(
    (immediate: boolean): void => {
      if (anchor === null || elementRef.current === null) return;
      const size = elementRef.current.getBoundingClientRect();
      if (size.width === 0 || size.height === 0) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };

      const resolved =
        strategy === 'radial' && centerAnchor !== null
          ? getRadialAnchorPosition(centerAnchor, anchor)
          : strategy === 'cursor'
            ? getCursorTooltipPosition(anchor.x, anchor.y)
            : { placement: preferredPlacement ?? 'right', anchor };

      const { point } = flipTooltipPosition(
        resolved.anchor,
        resolved.placement,
        { width: size.width, height: size.height },
        offset,
        viewport,
        VIEWPORT_PADDING,
      );
      const clamped = clampTooltipToViewport(point, { width: size.width, height: size.height }, viewport, VIEWPORT_PADDING);
      setTarget(clamped, { immediate });
    },
    [anchor, centerAnchor, strategy, preferredPlacement, offset, elementRef, setTarget],
  );

  // Позиция пересчитывается на каждое изменение anchor/payload — раздел 9: сначала payload (children), затем target.
  // useLayoutEffect + зависимость от `mounted`: при первом появлении DOM-узел (elementRef)
  // создаётся только когда mounted становится true на СЛЕДУЮЩЕМ рендере после setMounted(true);
  // без `mounted` в зависимостях этот эффект не перезапускался бы повторно для того рендера,
  // и tooltip оставался бы в исходных top:0/left:0 (виден один кадр в углу экрана).
  useLayoutEffect(() => {
    recompute(false);
  }, [recompute, children, mounted]);

  useEffect(() => {
    if (!visible) return undefined;

    const handleResize = (): void => {
      // Раздел 16: для mouse-driven tooltip при resize безопаснее скрыть, чем показать неверную позицию.
      if (strategy === 'anchor') {
        recompute(true);
      } else {
        onDismiss?.();
      }
    };
    const handleScroll = (): void => {
      if (strategy === 'anchor') {
        recompute(true);
      } else {
        onDismiss?.();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [visible, strategy, recompute, onDismiss]);

  if (!mounted) return null;

  const overlayRoot = document.getElementById('floating-ui-root') ?? document.body;

  return createPortal(
    <div
      ref={elementRef}
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: CHART_TOOLTIP_Z_INDEX,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 24px)',
        willChange: 'transform',
      }}
    >
      <div
        className={`transition-[opacity,transform] duration-125 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
          visible ? 'scale-100 opacity-100' : 'scale-[0.985] opacity-0'
        }`}
      >
        {children}
      </div>
    </div>,
    overlayRoot,
  );
}

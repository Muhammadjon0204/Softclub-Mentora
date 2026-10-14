import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { EASE_OUT_EXPO, SPRING_PILL, staggerContainerVariants, staggerItemVariants } from './motionTokens';

/**
 * Анимационные примитивы интерфейса. Все переходы короткие (180–450 мс) и только на
 * `transform`/`opacity`/`filter`; при `prefers-reduced-motion` их гасит `MotionConfig`
 * в корне приложения (`reducedMotion="user"`).
 */

/** Появление страницы при переходе в сайдбаре. */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      // После анимации снимаем filter: даже `blur(0px)` делает элемент containing block'ом
      // для position:fixed потомков и ломает их позиционирование.
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  );
}

/** Контейнер каскада: дети-`StaggerItem` появляются по очереди с шагом 45 мс. */
export function StaggerContainer({ children, className, ...rest }: HTMLMotionProps<'div'>): JSX.Element {
  return (
    <motion.div className={className} variants={staggerContainerVariants} initial="hidden" animate="show" {...rest}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...rest }: HTMLMotionProps<'div'>): JSX.Element {
  return (
    <motion.div className={className} variants={staggerItemVariants} {...rest}>
      {children}
    </motion.div>
  );
}

interface AnimatedNumberProps {
  value: number;
  /** Знаков после запятой. */
  decimals?: number;
  suffix?: string;
  className?: string;
  /** Длительность прокрутки, мс. */
  duration?: number;
}

/**
 * Число, которое докручивается до нового значения: с нуля при первом показе, с прежнего —
 * при смене периода или филиала. Пишет прямо в DOM, без ре-рендеров на каждый кадр.
 */
export function AnimatedNumber({ value, decimals = 0, suffix = '', className, duration = 450 }: AnimatedNumberProps): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(reduce === true ? value : 0);
  const text = useTransform(motionValue, (latest) =>
    `${latest.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
  );

  useEffect(() => {
    if (reduce === true) {
      motionValue.set(value);
      return undefined;
    }
    const controls = animate(motionValue, value, { duration: duration / 1000, ease: EASE_OUT_EXPO });
    return () => { controls.stop(); };
  }, [value, duration, reduce, motionValue]);

  useEffect(() => text.on('change', (latest) => {
    if (ref.current !== null) ref.current.textContent = latest;
  }), [text]);

  return (
    <span ref={ref} className={className}>
      {text.get()}
    </span>
  );
}

/**
 * Строка вида «24», «92%», «1 234» — докручивается как число; всё остальное («—», «5 дн.»)
 * показывается как есть.
 */
export function AnimatedValue({ value, className }: { value: string; className?: string }): JSX.Element {
  const match = /^(-?[\d\s ]+(?:[.,]\d+)?)(%?)$/.exec(value.trim());
  if (match === null) return <span className={className}>{value}</span>;
  const numeric = Number(match[1].replace(/[\s ]/g, '').replace(',', '.'));
  if (!Number.isFinite(numeric)) return <span className={className}>{value}</span>;
  const decimals = match[1].includes(',') || match[1].includes('.') ? (match[1].split(/[.,]/)[1]?.length ?? 0) : 0;
  return <AnimatedNumber value={numeric} decimals={decimals} suffix={match[2]} className={className} />;
}

/** Полоса прогресса, которая заполняется слева направо при появлении. */
export function AnimatedBar({ percent, className }: { percent: number; className: string }): JSX.Element {
  const width = `${String(Math.max(0, Math.min(100, percent)))}%`;
  return (
    <motion.span
      className={`block h-full ${className}`}
      initial={{ width: 0 }}
      animate={{ width }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  );
}

/** Фон активного пункта сайдбара — скользит к новому пункту. Родитель: `relative isolate`. */
export function NavActivePill(): JSX.Element {
  return (
    <motion.span
      layoutId="active-nav-pill"
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-control bg-brand-soft"
      transition={SPRING_PILL}
    />
  );
}

/** Фон выбранного таба/чипа фильтра. `layoutId` — свой у каждой группы табов на странице. */
export function FilterActivePill({ layoutId = 'active-filter-pill', className = 'rounded-full bg-brand-soft' }: { layoutId?: string; className?: string }): JSX.Element {
  return <motion.span layoutId={layoutId} aria-hidden="true" className={`absolute inset-0 -z-10 ${className}`} transition={SPRING_PILL} />;
}

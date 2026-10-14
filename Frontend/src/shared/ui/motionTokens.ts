import type { Transition, Variants } from 'framer-motion';

/** Резкий выход на финиш: быстро стартует, мягко садится. Для fade/slide и полос прогресса. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Пружины: карточки — мягче, плашки навигации — пожёстче, чтобы не «плавали». */
export const SPRING_ITEM: Transition = { type: 'spring', stiffness: 380, damping: 28 };
export const SPRING_PILL: Transition = { type: 'spring', stiffness: 420, damping: 32 };
export const SPRING_PANEL: Transition = { type: 'spring', stiffness: 350, damping: 32 };

/** Сколько первых элементов списка анимировать каскадом — дальше появляются сразу. */
export const STAGGER_LIMIT = 12;

export const staggerContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_ITEM },
};

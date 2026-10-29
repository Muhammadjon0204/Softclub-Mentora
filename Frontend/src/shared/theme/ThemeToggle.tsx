import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

import { useTranslation } from '../i18n/useTranslation';
import { SPRING_PILL } from '../ui/motionTokens';
import { useTheme } from './useTheme';

// Внутренний размер дорожки (без 1px рамки с каждой стороны): 46×26. Бегунок 22px с отступом
// 2px со всех сторон — сверху/снизу (26 − 22) / 2, слева/справа — те же 2px.
const TRACK_WIDTH = 48;
const KNOB_SIZE = 22;
const INSET = 2;
const KNOB_X_DARK = TRACK_WIDTH - 2 - KNOB_SIZE - INSET;

/**
 * Переключатель темы: знает только о двух состояниях (не «системная» — выбор явный и
 * осознанный, как и язык рядом с ним в topbar). Сама заливка страницы — не здесь, а в
 * `themeStore.ts`/`index.css` (`.theme-transition`): кнопка только меняет значение.
 *
 * Вертикаль бегунка — фиксированный `top`, а не `top-1/2 -translate-y-1/2`: framer-motion
 * пишет анимацию `x` в inline `transform` и тем самым затирает Tailwind-овский translate, из-за
 * чего бегунок съезжал вниз на половину своей высоты.
 */
export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      style={{ width: TRACK_WIDTH }}
      className="relative inline-flex h-7 shrink-0 items-center rounded-full border border-line bg-surface-muted transition-colors duration-200 hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* Неактивный вариант — бледно на свободной стороне дорожки. */}
      <Sun
        aria-hidden="true"
        className={`absolute left-[7px] h-3 w-3 text-ink-muted transition-opacity duration-200 ${isDark ? 'opacity-60' : 'opacity-0'}`}
      />
      <Moon
        aria-hidden="true"
        className={`absolute right-[7px] h-3 w-3 text-ink-muted transition-opacity duration-200 ${isDark ? 'opacity-0' : 'opacity-60'}`}
      />
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ x: isDark ? KNOB_X_DARK : INSET }}
        transition={SPRING_PILL}
        style={{ width: KNOB_SIZE, height: KNOB_SIZE, top: INSET }}
        className="absolute left-0 z-10 flex items-center justify-center rounded-full bg-surface shadow-surface"
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
        )}
      </motion.span>
    </button>
  );
}

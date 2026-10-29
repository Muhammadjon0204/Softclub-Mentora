import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

import { useTranslation } from '../i18n/useTranslation';
import { SPRING_PILL } from '../ui/motionTokens';
import { useTheme } from './useTheme';

const TRACK_WIDTH = 48;
const KNOB_SIZE = 20;
const PADDING = 2;
const KNOB_X_DARK = TRACK_WIDTH - KNOB_SIZE - PADDING;

/**
 * Переключатель темы: знает только о двух состояниях (не «системная» — выбор явный и
 * осознанный, как и язык рядом с ним в topbar). Сама заливка страницы — не здесь, а в
 * `themeStore.ts`/`index.css` (`.theme-transition`): кнопка только меняет значение.
 */
export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      onClick={toggleTheme}
      style={{ width: TRACK_WIDTH }}
      className={`relative inline-flex h-7 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        isDark ? 'border-line-strong bg-surface-muted' : 'border-line bg-surface-muted'
      }`}
    >
      <Sun
        aria-hidden="true"
        className={`absolute left-1.5 h-3.5 w-3.5 text-warning transition-opacity duration-200 ${isDark ? 'opacity-0' : 'opacity-100'}`}
      />
      <Moon
        aria-hidden="true"
        className={`absolute right-1.5 h-3.5 w-3.5 text-chart-violet transition-opacity duration-200 ${isDark ? 'opacity-100' : 'opacity-0'}`}
      />
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ x: isDark ? KNOB_X_DARK : PADDING }}
        transition={SPRING_PILL}
        style={{ width: KNOB_SIZE, height: KNOB_SIZE }}
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-surface shadow-surface"
      />
    </button>
  );
}

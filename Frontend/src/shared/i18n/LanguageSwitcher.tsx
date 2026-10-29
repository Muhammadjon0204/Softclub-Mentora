import { motion } from 'framer-motion';

import { SPRING_PILL } from '../ui/motionTokens';
import { SUPPORTED_LOCALES } from './translations';
import { useTranslation } from './useTranslation';

const LABEL: Record<string, string> = { ru: 'RU', tg: 'ТГ', en: 'EN' };

/**
 * Три кнопки фиксированной ширины, а не выпадающий `Select` с текстом варианта на триггере:
 * у `Select` ширина триггера зависит от длины выбранного лейбла («Русский» длиннее «English»), и
 * сама смена языка двигала бы topbar — ровно то, что задача просила не допускать. Активная пилюля
 * скользит между кнопками тем же `layoutId`-приёмом, что `NavActivePill` в сайдбаре.
 */
export function LanguageSwitcher(): JSX.Element {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t('lang.switcherLabel')}
      className="relative isolate inline-flex h-8 shrink-0 items-center gap-0.5 rounded-control-sm border border-line bg-surface-muted p-0.5"
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(`lang.${code}`)}
            onClick={() => { setLocale(code); }}
            className={`relative z-10 flex h-7 w-8 items-center justify-center rounded-[8px] text-[11px] font-semibold tabular-nums transition-colors duration-150 ${
              active ? 'text-brand' : 'text-ink-muted hover:text-ink-secondary'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="lang-switcher-active"
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-[8px] bg-surface shadow-surface"
                transition={SPRING_PILL}
              />
            ) : null}
            {LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}

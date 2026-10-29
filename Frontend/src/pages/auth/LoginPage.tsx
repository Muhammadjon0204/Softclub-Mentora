import { useSearchParams } from 'react-router-dom';

import type { SessionEndReason } from '../../auth/authEvents';
import { LoginForm } from '../../components/auth/LoginForm';
import { OfflineBanner } from '../../components/OfflineBanner';
import { BrandLogo } from '../../shared/branding/BrandLogo';
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';

/** Безопасные формулировки: ни одна не раскрывает деталей инцидента. */
const REASON_MESSAGE: Record<SessionEndReason, string> = {
  'session-expired': 'Сессия истекла. Войдите заново.',
  'session-compromised': 'Сессия завершена по соображениям безопасности. Войдите заново.',
  'csrf-failed': 'Проверка безопасности не пройдена. Войдите заново.',
};

function isSessionEndReason(value: string | null): value is SessionEndReason {
  return value !== null && value in REASON_MESSAGE;
}

/**
 * Одна центрированная карточка — без split-layout и marketing-контента
 * (откат после раунда фидбэка: прежняя версия ощущалась как landing page).
 */
export function LoginPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen bg-app">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(46rem 30rem at 50% -8rem, rgba(2,112,149,0.07), transparent 65%)',
        }}
      />

      <OfflineBanner />

      {/* Тема/язык доступны и до входа — выбор переживает логин через тот же localStorage. */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-6 sm:top-6">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-[12vh] pt-10 sm:px-6">
        <main className="w-full max-w-[440px]">
          <div className="mb-7 flex justify-center">
            <BrandLogo variant="full" />
          </div>

          <div className="rounded-panel border border-line bg-surface p-6 shadow-surface sm:p-8">
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">{t('auth.login.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              {t('auth.login.subtitle')}
            </p>

            {isSessionEndReason(reason) ? (
              <p
                role="status"
                className="mt-5 rounded-xl border border-line bg-brand-soft px-3.5 py-3 text-sm text-ink"
              >
                {REASON_MESSAGE[reason]}
              </p>
            ) : null}

            <div className="mt-7">
              <LoginForm />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

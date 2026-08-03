import { useState } from 'react';

import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { BrandLogo } from '../../components/auth/BrandLogo';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAuth } from '../../auth/useAuth';

interface DashboardPlaceholderProps {
  title: string;
}

/**
 * Заглушка вместо реального дашборда: нужна, чтобы отработал ролевой redirect
 * и было где проверить сессию. Сам дашборд проектируется отдельным модулем.
 *
 * Здесь же временно живёт ChangePasswordForm — до появления /profile.
 */
export function DashboardPlaceholder({ title }: DashboardPlaceholderProps): JSX.Element {
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <OfflineBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandLogo />
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Auth-модуль работает. Здесь будет реальный дашборд.
        </p>

        <dl className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Пользователь</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{user?.fullName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Роль</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{user?.role ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">CategoryId</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{user?.categoryId ?? '—'}</dd>
          </div>
        </dl>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setShowChangePassword((current) => !current);
            }}
            aria-expanded={showChangePassword}
            className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
          >
            {showChangePassword ? 'Скрыть смену пароля' : 'Сменить пароль'}
          </button>

          {showChangePassword ? (
            <div className="mt-4 max-w-md">
              <ChangePasswordForm />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

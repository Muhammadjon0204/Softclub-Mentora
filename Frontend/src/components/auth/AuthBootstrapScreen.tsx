import { BrandLogo } from '../../shared/branding/BrandLogo';
import { Spinner } from '../ui/Spinner';

/**
 * Экран первичного восстановления сессии.
 *
 * Показывается вместо мигания формы входа: пока идёт silent refresh, мы ещё
 * не знаем, аутентифицирован пользователь или нет.
 */
export function AuthBootstrapScreen(): JSX.Element {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50"
      role="status"
      aria-live="polite"
    >
      <BrandLogo />
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner className="h-4 w-4 text-indigo-600" />
        Восстанавливаем сессию…
      </div>
    </div>
  );
}

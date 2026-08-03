/**
 * Шпаргалка для ручного QA.
 *
 * Рендерится только в dev-сборке при включённых моках — в production
 * блок вырезается сборщиком вместе с этой проверкой.
 */
const ACCOUNTS = [
  { email: 'admin@mentortaskflow.test', note: 'Organization Admin — Главный офис + все филиалы' },
  { email: 'organization-admin@mentortaskflow.test', note: 'Organization Admin — второй аккаунт' },
  { email: 'branch-admin-head@mentortaskflow.test', note: 'Branch Admin — Главный офис' },
  { email: 'branch-admin-khujand@mentortaskflow.test', note: 'Branch Admin — Филиал Худжанд' },
  { email: 'lead@mentortaskflow.test', note: 'Lead — обычный вход' },
  { email: 'lead-head@mentortaskflow.test', note: 'Lead — C#, Главный офис' },
  { email: 'lead-khujand@mentortaskflow.test', note: 'Lead — C#, Филиал Худжанд (изоляция)' },
  { email: 'mentor@mentortaskflow.test', note: 'Mentor — обычный вход' },
  { email: 'mentor-head@mentortaskflow.test', note: 'Mentor — C#, Главный офис' },
  { email: 'mentor-khujand@mentortaskflow.test', note: 'Mentor — C#, Филиал Худжанд (изоляция)' },
  { email: 'locked@mentortaskflow.test', note: 'Lockout активен — тот же 401' },
  { email: 'invited@mentortaskflow.test', note: 'PasswordHash = null — тот же 401' },
  { email: 'reuse@mentortaskflow.test', note: 'Для сценария refresh reuse' },
];

const LINKS = [
  { href: '/reset-password?token=reset-valid-token', label: 'Рабочая ссылка сброса' },
  { href: '/reset-password?token=reset-expired-token', label: 'Просроченный reset-токен' },
  { href: '/reset-password?token=reset-used-token', label: 'Уже использованный reset-токен' },
  { href: '/set-password?token=set-valid-token', label: 'Приглашение (set-password)' },
  { href: '/set-password?token=set-expired-token', label: 'Просроченное приглашение' },
];

export function MockCredentialsHint(): JSX.Element | null {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS !== 'true') return null;

  return (
    <details className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-left">
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-600">
        Тестовые данные (моки)
      </summary>

      <div className="mt-3 space-y-3 text-xs text-slate-500">
        <div>
          <p className="font-semibold text-slate-600">
            Пароль: <code className="text-indigo-600">DemoPassword1!</code>
          </p>
          <ul className="mt-1.5 space-y-1">
            {ACCOUNTS.map((account) => (
              <li key={account.email}>
                <code className="text-slate-700">{account.email}</code> — {account.note}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-600">Сценарии по ссылке:</p>
          <ul className="mt-1.5 space-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a className="text-indigo-600 hover:underline" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p>
          Lockout — после 5 неудачных попыток на 15 минут. Ссылки из «Забыли пароль?»
          печатаются в консоль. Утилиты QA — в <code>window.mtfMocks</code>.
        </p>
      </div>
    </details>
  );
}

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const DEMO_PASSWORD = 'DemoPassword1!';

interface DevAccount {
  email: string;
  note: string;
}

interface DevAccountGroup {
  role: string;
  accounts: DevAccount[];
}

/** Те же аккаунты, что и раньше в MockCredentialsHint — значения не менялись. */
const ACCOUNT_GROUPS: DevAccountGroup[] = [
  {
    role: 'Organization Admin',
    accounts: [
      { email: 'admin@mentortaskflow.test', note: 'Главный офис + все филиалы' },
      { email: 'organization-admin@mentortaskflow.test', note: 'Второй аккаунт' },
    ],
  },
  {
    role: 'Branch Admin',
    accounts: [
      { email: 'branch-admin-head@mentortaskflow.test', note: 'Главный офис' },
      { email: 'branch-admin-khujand@mentortaskflow.test', note: 'Филиал Худжанд' },
    ],
  },
  {
    role: 'Lead',
    accounts: [
      { email: 'lead@mentortaskflow.test', note: 'Обычный вход' },
      { email: 'lead-head@mentortaskflow.test', note: 'C#, Главный офис' },
      { email: 'lead-khujand@mentortaskflow.test', note: 'C#, Филиал Худжанд — изоляция' },
    ],
  },
  {
    role: 'Mentor',
    accounts: [
      { email: 'mentor@mentortaskflow.test', note: 'Обычный вход' },
      { email: 'mentor-head@mentortaskflow.test', note: 'C#, Главный офис' },
      { email: 'mentor-khujand@mentortaskflow.test', note: 'C#, Филиал Худжанд — изоляция' },
    ],
  },
];

const EDGE_CASE_ACCOUNTS: DevAccount[] = [
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

interface AccountRowProps {
  account: DevAccount;
  onFill: (email: string, password: string) => void;
}

function AccountRow({ account, onFill }: AccountRowProps): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-3 rounded-control-sm px-2 py-1.5 transition-colors duration-150 hover:bg-surface-hover motion-reduce:transition-none">
      <span className="min-w-0">
        <span className="block truncate font-mono text-xs text-ink">{account.email}</span>
        <span className="block text-[11px] text-ink-muted">{account.note}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          onFill(account.email, DEMO_PASSWORD);
        }}
        className="shrink-0 rounded-control-sm border border-line px-2.5 py-1 text-[11px] font-medium text-brand transition-colors duration-150 hover:border-[rgba(91,92,226,0.4)] hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand motion-reduce:transition-none"
      >
        Подставить
      </button>
    </li>
  );
}

interface DevAccountsPanelProps {
  /** Заполняет существующие поля формы — auto-login не выполняется. */
  onFill: (email: string, password: string) => void;
}

/**
 * Dev-only шпаргалка для ручного QA (замена MockCredentialsHint).
 *
 * Рендерится только в dev-сборке при включённых моках — в production блок
 * вырезается сборщиком вместе с этой проверкой (раздел 11/19 брендинга Login).
 */
export function DevAccountsPanel({ onFill }: DevAccountsPanelProps): JSX.Element | null {
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS !== 'true') return null;

  return (
    <div className="rounded-panel border border-line bg-surface text-left">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-controls="dev-accounts-panel"
        className="flex w-full items-center justify-between gap-2 rounded-panel px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand motion-reduce:transition-none"
      >
        <span className="flex items-center gap-2">
          Тестовые аккаунты
          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            DEV
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-ink-disabled transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          id="dev-accounts-panel"
          role="region"
          aria-label="Тестовые аккаунты"
          className="animate-fade-in px-4 pb-4 motion-reduce:animate-none"
        >
          <p className="text-xs text-ink-muted">
            Пароль для всех аккаунтов: <code className="text-brand">{DEMO_PASSWORD}</code>
          </p>

          <div className="mt-3 space-y-3">
            {ACCOUNT_GROUPS.map((group) => (
              <div key={group.role}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-disabled">{group.role}</p>
                <ul className="mt-1 space-y-0.5">
                  {group.accounts.map((account) => (
                    <AccountRow key={account.email} account={account} onFill={onFill} />
                  ))}
                </ul>
              </div>
            ))}

            <details className="group">
              <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-ink-disabled">
                Граничные случаи
              </summary>
              <ul className="mt-1 space-y-0.5">
                {EDGE_CASE_ACCOUNTS.map((account) => (
                  <AccountRow key={account.email} account={account} onFill={onFill} />
                ))}
              </ul>
            </details>
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-disabled">Сценарии по ссылке</p>
            <ul className="mt-1.5 space-y-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a className="text-xs text-brand hover:underline" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-disabled">
            Lockout — после 5 неудачных попыток на 15 минут. Ссылки из «Забыли пароль?» печатаются в консоль.
            Утилиты QA — в <code>window.mtfMocks</code>.
          </p>
        </div>
      ) : null}
    </div>
  );
}

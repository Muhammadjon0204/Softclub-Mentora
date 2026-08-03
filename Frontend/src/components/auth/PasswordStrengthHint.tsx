import { PASSWORD_RULES } from '../../schemas/auth.schema';

interface PasswordStrengthHintProps {
  password: string;
  confirmPassword: string;
}

function Requirement({ satisfied, label }: { satisfied: boolean; label: string }): JSX.Element {
  return (
    <li className="flex items-center gap-2">
      {/* Статус передаётся не только цветом: галочка/точка + текстовая подпись. */}
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          satisfied ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white text-slate-400'
        }`}
      >
        {satisfied ? (
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="block h-1 w-1 rounded-full bg-current" />
        )}
      </span>
      <span className={satisfied ? 'text-emerald-800' : 'text-slate-600'}>
        {label}
        <span className="sr-only">{satisfied ? ' — выполнено' : ' — не выполнено'}</span>
      </span>
    </li>
  );
}

/**
 * Требования к паролю и совпадение полей — в реальном времени.
 *
 * Словарь top-10000 здесь не проверяется: это делает сервер, ответ приходит
 * как `400 VALIDATION_FAILED`.
 */
export function PasswordStrengthHint({
  password,
  confirmPassword,
}: PasswordStrengthHintProps): JSX.Element {
  const matches = password.length > 0 && password === confirmPassword;

  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3">
      <ul className="space-y-1.5 text-sm">
        {PASSWORD_RULES.map((rule) => (
          <Requirement key={rule.id} satisfied={rule.test(password)} label={rule.label} />
        ))}
        {confirmPassword.length > 0 ? (
          <Requirement satisfied={matches} label="Пароли совпадают" />
        ) : null}
      </ul>
      <p aria-live="polite" className="sr-only">
        {confirmPassword.length === 0 ? '' : matches ? 'Пароли совпадают' : 'Пароли не совпадают'}
      </p>
      <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
        Дополнительно пароль проверяется на сервере по списку часто используемых.
      </p>
    </div>
  );
}

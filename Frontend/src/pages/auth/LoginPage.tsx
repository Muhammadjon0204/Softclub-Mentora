import { useSearchParams } from 'react-router-dom';

import type { SessionEndReason } from '../../auth/authEvents';
import { AuthCard } from '../../components/auth/AuthCard';
import { LoginForm } from '../../components/auth/LoginForm';
import { MockCredentialsHint } from '../../components/auth/MockCredentialsHint';

/** Безопасные формулировки: ни одна не раскрывает деталей инцидента. */
const REASON_MESSAGE: Record<SessionEndReason, string> = {
  'session-expired': 'Сессия истекла. Войдите заново.',
  'session-compromised': 'Сессия завершена по соображениям безопасности. Войдите заново.',
  'csrf-failed': 'Проверка безопасности не пройдена. Войдите заново.',
};

function isSessionEndReason(value: string | null): value is SessionEndReason {
  return value !== null && value in REASON_MESSAGE;
}

export function LoginPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  return (
    <AuthCard
      title="Вход в систему"
      description="Введите рабочий email и пароль, чтобы продолжить."
      footer={<MockCredentialsHint />}
    >
      {isSessionEndReason(reason) ? (
        <p
          role="status"
          className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 text-sm text-indigo-800"
        >
          {REASON_MESSAGE[reason]}
        </p>
      ) : null}

      <LoginForm />
    </AuthCard>
  );
}

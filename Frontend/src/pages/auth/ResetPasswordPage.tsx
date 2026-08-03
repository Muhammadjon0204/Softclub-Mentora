import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { authApi } from '../../api/auth';
import { AuthCard } from '../../components/auth/AuthCard';
import { PasswordSetupForm } from '../../components/auth/PasswordSetupForm';

const TITLES = {
  form: 'Новый пароль',
  success: 'Пароль обновлён',
  'invalid-link': 'Ссылка недействительна',
} as const;

const DESCRIPTIONS = {
  form: 'Придумайте новый пароль. После сохранения все активные сессии будут завершены.',
  success: undefined,
  'invalid-link': undefined,
} as const;

export function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [screen, setScreen] = useState<keyof typeof TITLES>('form');

  return (
    <AuthCard title={TITLES[screen]} description={DESCRIPTIONS[screen]}>
      <PasswordSetupForm
        token={searchParams.get('token')}
        submit={authApi.resetPassword}
        onScreenChange={setScreen}
        texts={{
          submitLabel: 'Сохранить пароль',
          successText: 'Войдите в систему с новым паролем.',
        }}
      />
    </AuthCard>
  );
}

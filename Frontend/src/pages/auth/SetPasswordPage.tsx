import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { authApi } from '../../api/auth';
import { AuthCard } from '../../components/auth/AuthCard';
import { PasswordSetupForm } from '../../components/auth/PasswordSetupForm';

const TITLES = {
  form: 'Создание пароля',
  success: 'Аккаунт активирован',
  'invalid-link': 'Ссылка недействительна',
} as const;

const DESCRIPTIONS = {
  // Никаких email и имён: до успешной отправки страница ничего не знает о пользователе.
  form: 'Придумайте пароль для входа в MentorTaskFlow. Это последний шаг активации аккаунта.',
  success: undefined,
  'invalid-link': undefined,
} as const;

export function SetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [screen, setScreen] = useState<keyof typeof TITLES>('form');

  return (
    <AuthCard title={TITLES[screen]} description={DESCRIPTIONS[screen]}>
      <PasswordSetupForm
        token={searchParams.get('token')}
        submit={authApi.setPassword}
        onScreenChange={setScreen}
        texts={{
          submitLabel: 'Создать пароль',
          successText: 'Войдите в систему, чтобы начать работу.',
        }}
      />
    </AuthCard>
  );
}

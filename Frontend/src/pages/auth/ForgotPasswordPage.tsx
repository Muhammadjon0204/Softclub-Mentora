import { Link } from 'react-router-dom';

import { AuthCard } from '../../components/auth/AuthCard';
import { ForgotPasswordForm } from '../../components/auth/ForgotPasswordForm';

export function ForgotPasswordPage(): JSX.Element {
  return (
    <AuthCard
      title="Восстановление пароля"
      description="Укажите email, привязанный к аккаунту. Мы отправим на него ссылку для установки нового пароля."
      footer={
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
          Вернуться ко входу
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}

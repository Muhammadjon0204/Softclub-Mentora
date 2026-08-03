import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

import { AUTH_ERROR_CODE, getProblemCode } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { changePasswordSchema, type ChangePasswordFormValues } from '../../schemas/auth.schema';
import { PasswordField } from '../ui/TextField';
import { applyServerValidation } from './applyServerValidation';
import { AuthError } from './AuthError';
import { PasswordStrengthHint } from './PasswordStrengthHint';
import { SubmitButton } from './SubmitButton';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

/**
 * Смена пароля аутентифицированным пользователем.
 *
 * Публичного маршрута у формы нет — она предназначена для будущего /profile.
 * После успеха сервер отзывает остальные сессии, а новый access-токен
 * кладётся в memory tokenStore (это делает AuthProvider.changePassword).
 */
export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps): JSX.Element {
  const { changePassword } = useAuth();
  const isOnline = useOnlineStatus();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    retry: false,
    onSuccess: () => {
      reset();
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const code = getProblemCode(error);

      if (code === AUTH_ERROR_CODE.INVALID_CREDENTIALS) {
        setError('currentPassword', { type: 'server', message: 'Неверный текущий пароль' });
        setFocus('currentPassword');
        return;
      }
      if (code === AUTH_ERROR_CODE.VALIDATION_FAILED) {
        applyServerValidation<ChangePasswordFormValues>(
          error,
          ['currentPassword', 'newPassword', 'confirmPassword'],
          setError,
          setFocus,
        );
      }
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!isOnline || mutation.isPending) return;
    mutation.mutate(values);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordField
        label="Текущий пароль"
        autoComplete="current-password"
        disabled={mutation.isPending}
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <PasswordField
        label="Новый пароль"
        autoComplete="new-password"
        disabled={mutation.isPending}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />

      <PasswordField
        label="Повторите новый пароль"
        autoComplete="new-password"
        disabled={mutation.isPending}
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <PasswordStrengthHint password={newPassword} confirmPassword={confirmPassword} />

      {mutation.isSuccess ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
        >
          Пароль изменён. Остальные сессии завершены.
        </p>
      ) : null}

      {!isOnline ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          Нет соединения — сохранение временно недоступно.
        </p>
      ) : null}

      <AuthError error={mutation.error} />

      <SubmitButton isSubmitting={mutation.isPending} disabled={!isOnline}>
        Изменить пароль
      </SubmitButton>
    </form>
  );
}

import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

import { AUTH_ERROR_CODE, getProblemCode, getRetryAfter } from '../../api/problemDetails';
import { dashboardPathForRole } from '../../auth/roleRedirect';
import { useAuth } from '../../auth/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useRateLimitCountdown } from '../../hooks/useRateLimitCountdown';
import { loginSchema, type LoginFormValues } from '../../schemas/auth.schema';
import { PasswordField, TextField } from '../ui/TextField';
import { applyServerValidation } from './applyServerValidation';
import { AuthError } from './AuthError';
import { SubmitButton } from './SubmitButton';

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const { login } = useAuth();
  const isOnline = useOnlineStatus();
  const countdown = useRateLimitCountdown();

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => login(values),
    retry: false,
    onSuccess: (user) => {
      // Роль берём исключительно из ответа API.
      navigate(dashboardPathForRole(user.role), { replace: true });
    },
    onError: (error: unknown) => {
      const code = getProblemCode(error);

      if (code === AUTH_ERROR_CODE.RATE_LIMIT_EXCEEDED) {
        countdown.start(getRetryAfter(error) ?? 60);
        return;
      }
      if (code === AUTH_ERROR_CODE.VALIDATION_FAILED) {
        applyServerValidation<LoginFormValues>(error, ['email', 'password'], setError, setFocus);
      }
    },
  });

  const isBlocked = !isOnline || countdown.isActive;

  const onSubmit = handleSubmit((values) => {
    if (isBlocked || mutation.isPending) return;
    mutation.mutate(values);
  });

  return (
    <div className="space-y-5">
      {!isOnline ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          Нет соединения — вход временно недоступен.
        </p>
      ) : null}

      <AuthError error={mutation.error} retryAfterSeconds={countdown.isActive ? countdown.remaining : null} />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@company.com"
          autoFocus
          tone="auth"
          disabled={mutation.isPending}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="space-y-2">
          <PasswordField
            label="Пароль"
            autoComplete="current-password"
            tone="auth"
            disabled={mutation.isPending}
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="rounded text-sm font-medium text-brand transition-colors duration-150 hover:text-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
            >
              Забыли пароль?
            </Link>
          </div>
        </div>

        <SubmitButton
          tone="auth"
          isSubmitting={mutation.isPending}
          disabled={isBlocked}
          submittingLabel="Выполняется вход"
          className="mt-2"
        >
          {countdown.isActive ? `Повторить через ${String(countdown.remaining)} сек.` : 'Войти'}
        </SubmitButton>
      </form>

    </div>
  );
}

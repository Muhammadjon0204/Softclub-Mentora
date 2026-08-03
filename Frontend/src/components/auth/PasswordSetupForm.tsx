import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

import { AUTH_ERROR_CODE, getProblemCode, getRetryAfter } from '../../api/problemDetails';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useRateLimitCountdown } from '../../hooks/useRateLimitCountdown';
import { passwordSetupSchema, type PasswordSetupFormValues } from '../../schemas/auth.schema';
import { PasswordField } from '../ui/TextField';
import { applyServerValidation } from './applyServerValidation';
import { AuthError } from './AuthError';
import { PasswordStrengthHint } from './PasswordStrengthHint';
import { SubmitButton } from './SubmitButton';

export interface PasswordSetupTexts {
  submitLabel: string;
  /** Заголовок успеха задаёт страница через AuthCard — здесь только пояснение. */
  successText: string;
}

interface PasswordSetupFormProps {
  /** Значение `?token=`. Не отображается и не декодируется. */
  token: string | null;
  submit: (payload: { token: string; newPassword: string }) => Promise<void>;
  texts: PasswordSetupTexts;
  /** Заголовок карточки задаёт страница; здесь он нужен для success/invalid экранов. */
  onScreenChange?: (screen: 'form' | 'success' | 'invalid-link') => void;
}

const PRIMARY_BUTTON =
  'inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

/**
 * Общая форма для /reset-password и /set-password.
 *
 * Токен проверяется ТОЛЬКО в момент отправки: никакого предварительного GET,
 * никакого декодирования, никакого показа email или имени пользователя.
 */
export function PasswordSetupForm({
  token,
  submit,
  texts,
  onScreenChange,
}: PasswordSetupFormProps): JSX.Element {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const countdown = useRateLimitCountdown();

  // Токена в URL нет — экран-заглушка сразу, без обращения к API.
  const [isLinkInvalid, setIsLinkInvalid] = useState(token === null || token.length === 0);
  const [isDone, setIsDone] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<PasswordSetupFormValues>({
    resolver: zodResolver(passwordSetupSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');

  const mutation = useMutation({
    mutationFn: async (values: PasswordSetupFormValues): Promise<void> => {
      if (token === null) throw new Error('Токен отсутствует');
      await submit({ token, newPassword: values.newPassword });
    },
    retry: false,
    onSuccess: () => {
      setIsDone(true);
      onScreenChange?.('success');
    },
    onError: (error: unknown) => {
      const code = getProblemCode(error);

      if (code === AUTH_ERROR_CODE.SECURITY_TOKEN_INVALID) {
        setIsLinkInvalid(true);
        onScreenChange?.('invalid-link');
        return;
      }
      if (code === AUTH_ERROR_CODE.RATE_LIMIT_EXCEEDED) {
        countdown.start(getRetryAfter(error) ?? 60);
        return;
      }
      if (code === AUTH_ERROR_CODE.VALIDATION_FAILED) {
        applyServerValidation<PasswordSetupFormValues>(
          error,
          ['newPassword', 'confirmPassword'],
          setError,
          setFocus,
        );
      }
    },
  });

  if (isLinkInvalid) {
    return (
      <div className="space-y-5">
        <p role="alert" className="text-sm leading-relaxed text-slate-600">
          Ссылка недействительна или устарела. Она действует ограниченное время и только один раз.
        </p>
        <button
          type="button"
          onClick={() => {
            navigate('/forgot-password', { replace: true });
          }}
          className={PRIMARY_BUTTON}
        >
          Запросить новую ссылку
        </button>
        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    );
  }

  if (isDone) {
    // Auto-login после установки пароля не выполняется намеренно.
    return (
      <div className="space-y-5" aria-live="polite">
        <p className="text-sm leading-relaxed text-slate-600">{texts.successText}</p>
        <Link to="/login" className={PRIMARY_BUTTON}>
          Перейти ко входу
        </Link>
      </div>
    );
  }

  const isBlocked = !isOnline || countdown.isActive;

  const onSubmit = handleSubmit((values) => {
    if (isBlocked || mutation.isPending) return;
    mutation.mutate(values);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordField
        label="Новый пароль"
        autoComplete="new-password"
        autoFocus
        disabled={mutation.isPending}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />

      <PasswordField
        label="Повторите пароль"
        autoComplete="new-password"
        disabled={mutation.isPending}
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <PasswordStrengthHint password={newPassword} confirmPassword={confirmPassword} />

      {!isOnline ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          Нет соединения — сохранение временно недоступно.
        </p>
      ) : null}

      <AuthError
        error={mutation.error}
        retryAfterSeconds={countdown.isActive ? countdown.remaining : null}
      />

      <SubmitButton isSubmitting={mutation.isPending} disabled={isBlocked}>
        {countdown.isActive
          ? `Повторить через ${String(countdown.remaining)} сек.`
          : texts.submitLabel}
      </SubmitButton>
    </form>
  );
}

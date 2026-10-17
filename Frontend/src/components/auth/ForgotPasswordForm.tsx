import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';

import { authApi } from '../../api/auth';
import { AUTH_ERROR_CODE, getProblemCode, getRetryAfter } from '../../api/problemDetails';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useRateLimitCountdown } from '../../hooks/useRateLimitCountdown';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../../schemas/auth.schema';
import { TextField } from '../ui/TextField';
import { applyServerValidation } from './applyServerValidation';
import { AuthError } from './AuthError';
import { SubmitButton } from './SubmitButton';

type Channel = ForgotPasswordFormValues['channel'];

const SUCCESS_TEXT: Record<Channel, string> = {
  email: 'Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.',
  telegram:
    'Если такой email зарегистрирован, ссылка для сброса пароля отправлена в Telegram. Если Telegram не привязан к аккаунту — она придёт на почту.',
};

const CHANNELS: { value: Channel; label: string; hint: string; Icon: typeof Mail }[] = [
  { value: 'email', label: 'На почту', hint: 'на адрес аккаунта', Icon: Mail },
  { value: 'telegram', label: 'В Telegram', hint: 'если бот привязан в профиле', Icon: Send },
];

export function ForgotPasswordForm(): JSX.Element {
  const isOnline = useOnlineStatus();
  const countdown = useRateLimitCountdown();

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    watch,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '', channel: 'email' },
  });

  const channel = watch('channel');

  const mutation = useMutation({
    mutationFn: (values: ForgotPasswordFormValues) => authApi.forgotPassword(values),
    retry: false,
    onError: (error: unknown) => {
      const code = getProblemCode(error);

      if (code === AUTH_ERROR_CODE.RATE_LIMIT_EXCEEDED) {
        countdown.start(getRetryAfter(error) ?? 60);
        return;
      }
      if (code === AUTH_ERROR_CODE.VALIDATION_FAILED) {
        applyServerValidation<ForgotPasswordFormValues>(error, ['email'], setError, setFocus);
      }
    },
  });

  // 202 приходит одинаково и для существующего email, и для неизвестного,
  // и для отключённого пользователя — экран успеха ровно один на каждый канал.
  if (mutation.isSuccess) {
    return (
      <div className="space-y-5" aria-live="polite">
        <p className="text-sm leading-relaxed text-slate-600">{SUCCESS_TEXT[mutation.variables.channel]}</p>
        <p className="text-sm text-slate-500">Ссылка действует 30 минут и сработает один раз.</p>
        <Link
          to="/login"
          className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
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
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@company.com"
        autoFocus
        disabled={mutation.isPending}
        error={errors.email?.message}
        {...register('email')}
      />

      <fieldset disabled={mutation.isPending}>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Куда отправить ссылку</legend>
        <div className="grid grid-cols-2 gap-2">
          {CHANNELS.map(({ value, label, hint, Icon }) => {
            const active = channel === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                  active ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input type="radio" value={value} className="sr-only" {...register('channel')} />
                <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="leading-tight">
                  <span className={`block text-sm font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {!isOnline ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          Нет соединения — отправка временно недоступна.
        </p>
      ) : null}

      <AuthError
        error={mutation.error}
        retryAfterSeconds={countdown.isActive ? countdown.remaining : null}
      />

      <SubmitButton isSubmitting={mutation.isPending} disabled={isBlocked}>
        {countdown.isActive
          ? `Повторить через ${String(countdown.remaining)} сек.`
          : 'Отправить ссылку'}
      </SubmitButton>
    </form>
  );
}

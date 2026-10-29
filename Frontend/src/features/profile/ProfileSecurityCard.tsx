import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, LogOut, Monitor, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { getGenericErrorMessage } from '../../api/problemDetails';
import { getSessions, revokeOtherSessions } from '../../api/profile';
import { useAuth } from '../../auth/useAuth';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../schemas/auth.schema';
import { ConfirmDialog, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { FormField, FormInput } from '../../shared/ui/FormField';
import { pluralizeRu } from '../admin-assignments/assignmentPresentation';
import { describeBrowser, isHandheld } from './profilePresentation';
import { intlLocale } from '../../shared/i18n/intl';

const SESSIONS_QUERY_KEY = ['auth', 'sessions'] as const;

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (value: string) => void; autoComplete: string; invalid?: boolean }): JSX.Element {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <FormInput id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => { onChange(event.target.value); }} autoComplete={autoComplete} invalid={invalid} className="pr-10" />
      <button type="button" onClick={() => { setVisible((v) => !v); }} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-muted hover:text-ink" aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}>
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Смена пароля и управление сессиями на других устройствах. */
export function ProfileSecurityCard(): JSX.Element {
  const { changePassword } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const sessionsQuery = useQuery({ queryKey: SESSIONS_QUERY_KEY, queryFn: getSessions });
  const revoke = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async ({ revoked }) => {
      setConfirmRevoke(false);
      toast.success(revoked === 0 ? 'Других активных сессий не было' : `Завершено ${String(revoked)} ${pluralizeRu(revoked, 'сессия', 'сессии', 'сессий')} на других устройствах`);
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
    onError: (error) => { toast.error(getGenericErrorMessage(error)); },
  });

  const lengthError = next.length > 0 && (next.length < PASSWORD_MIN_LENGTH || next.length > PASSWORD_MAX_LENGTH)
    ? `От ${String(PASSWORD_MIN_LENGTH)} до ${String(PASSWORD_MAX_LENGTH)} символов`
    : undefined;
  const mismatch = confirm.length > 0 && confirm !== next ? 'Пароли не совпадают' : undefined;
  const canSubmit = current.length > 0 && next.length > 0 && confirm.length > 0 && lengthError === undefined && mismatch === undefined && !saving;

  async function submit(): Promise<void> {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent(''); setNext(''); setConfirm('');
      toast.success('Пароль обновлён. На других устройствах нужно будет войти заново');
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const others = sessionsQuery.data?.otherActiveSessions ?? 0;
  const lastLogin = sessionsQuery.data?.lastLoginAt;

  return (
    <Card padded={false}>
      <div className="border-b border-divider px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold text-ink">Безопасность и вход</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">Пароль и устройства, на которых вы вошли</p>
      </div>

      <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <FormField label="Текущий пароль" htmlFor="pwd-current">
          <PasswordInput id="pwd-current" value={current} onChange={setCurrent} autoComplete="current-password" />
        </FormField>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Новый пароль" htmlFor="pwd-new" error={lengthError} hint={lengthError === undefined ? `От ${String(PASSWORD_MIN_LENGTH)} до ${String(PASSWORD_MAX_LENGTH)} символов` : undefined}>
            <PasswordInput id="pwd-new" value={next} onChange={setNext} autoComplete="new-password" invalid={lengthError !== undefined} />
          </FormField>
          <FormField label="Подтверждение пароля" htmlFor="pwd-confirm" error={mismatch}>
            <PasswordInput id="pwd-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={mismatch !== undefined} />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>{saving ? 'Обновляем…' : 'Обновить пароль'}</Button>
        </div>
      </form>

      {/* Телефон: текст на всю ширину, кнопка под ним во всю строку. С sm — одна строка, кнопка справа. */}
      <div className="flex flex-col gap-4 border-t border-divider px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface-muted text-ink-secondary">
            {isHandheld(navigator.userAgent)
              ? <Smartphone className="h-5 w-5" aria-hidden="true" />
              : <Monitor className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-medium leading-5 text-ink">
              <span>{describeBrowser(navigator.userAgent)}</span>
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">Это устройство</span>
            </p>
            <p className="text-[12px] leading-[17px] text-ink-muted">
              {lastLogin ? `Последний вход: ${new Date(lastLogin).toLocaleString(intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false })}` : 'Последний вход: —'}
            </p>
            <p className="flex items-center gap-1.5 text-[12px] leading-[17px] text-ink-muted">
              <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${others > 0 ? 'bg-warning' : 'bg-success'}`} />
              {sessionsQuery.isPending ? 'Проверяем другие устройства…' : others === 0 ? 'Других активных сессий нет' : `Ещё ${String(others)} ${pluralizeRu(others, 'активная сессия', 'активные сессии', 'активных сессий')}`}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          leadingIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
          disabled={others === 0 || revoke.isPending}
          onClick={() => { setConfirmRevoke(true); }}
        >
          Завершить другие сессии
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Завершить другие сессии?"
        description="На всех остальных устройствах и в других браузерах нужно будет войти заново. Эта вкладка останется в системе."
        confirmLabel="Завершить"
        destructive
        loading={revoke.isPending}
        onConfirm={() => { revoke.mutate(); }}
      />
    </Card>
  );
}

import { Copy, Globe2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { AuthUser } from '../../api/auth';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { updateProfile } from '../../api/profile';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { FormField, FormInput } from '../../shared/ui/FormField';
import { DEFAULT_TIMEZONE } from '../admin-branches/branchPresentation';
import { timeZoneLabel } from './profilePresentation';

const NAME_MIN = 2;
const NAME_MAX = 100;

/** Имя редактируется; email — логин, меняется только через администратора. */
export function ProfilePersonalCard({ user }: { user: AuthUser }): JSX.Element {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setFullName(user.fullName); }, [user.fullName]);

  const trimmed = fullName.trim();
  const isDirty = trimmed !== user.fullName;
  const error = trimmed.length < NAME_MIN || trimmed.length > NAME_MAX ? `От ${String(NAME_MIN)} до ${String(NAME_MAX)} символов` : undefined;
  const timeZone = user.category?.timeZoneId ?? DEFAULT_TIMEZONE;

  async function save(): Promise<void> {
    if (error !== undefined) return;
    setSaving(true);
    try {
      updateUser(await updateProfile(trimmed));
      toast.success('Имя сохранено');
    } catch (e) {
      toast.error(getGenericErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function copyEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText(user.email);
      toast.success('Email скопирован');
    } catch {
      toast.error('Не удалось скопировать');
    }
  }

  return (
    <Card padded={false}>
      <div className="border-b border-divider px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold text-ink">Личные данные</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">Так вас видят коллеги в заданиях, проверках и уведомлениях</p>
      </div>

      <form
        className="space-y-4 px-5 py-5 sm:px-6"
        onSubmit={(event) => { event.preventDefault(); void save(); }}
      >
        <FormField label="Имя и фамилия" htmlFor="profile-name" error={isDirty ? error : undefined}>
          <FormInput id="profile-name" value={fullName} onChange={(event) => { setFullName(event.target.value); }} maxLength={NAME_MAX} invalid={isDirty && error !== undefined} autoComplete="name" />
        </FormField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Email" htmlFor="profile-email" hint="Используется для входа — меняет администратор">
            <div className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface-muted px-3">
              <Lock className="h-3.5 w-3.5 shrink-0 text-ink-disabled" aria-hidden="true" />
              <input id="profile-email" value={user.email} readOnly className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-secondary outline-none" />
              <button type="button" onClick={() => { void copyEmail(); }} className="shrink-0 rounded p-1 text-ink-muted transition hover:bg-surface hover:text-brand" aria-label="Скопировать email">
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </FormField>

          <FormField label="Часовой пояс и язык" htmlFor="profile-locale" hint="Дедлайны показываются по поясу вашего направления">
            <div id="profile-locale" className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface-muted px-3 text-[13px] text-ink-secondary">
              <Globe2 className="h-3.5 w-3.5 shrink-0 text-ink-disabled" aria-hidden="true" />
              {timeZoneLabel(timeZone)} · Русский
            </div>
          </FormField>
        </div>

        <div className="flex justify-end gap-2 border-t border-divider pt-4">
          <Button variant="secondary" type="button" disabled={!isDirty || saving} onClick={() => { setFullName(user.fullName); }}>
            Отменить
          </Button>
          <Button variant="primary" type="submit" disabled={!isDirty || error !== undefined || saving}>
            {saving ? 'Сохраняем…' : 'Сохранить изменения'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

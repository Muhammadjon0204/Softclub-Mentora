import { Check, Lock, Minus, X } from 'lucide-react';

import { Skeleton } from '../../shared/ui/Skeleton';
import { ErrorState } from '../../shared/ui/ErrorState';
import { useToast } from '../../shared/overlays';
import { PERMISSION_GROUP_LABEL, PERMISSION_INFO } from './permissionPresentation';
import { useUserPermissions } from './useUserPermissions';

type Choice = 'role' | 'allow' | 'deny';

const CHOICES: { id: Choice; label: string; icon: typeof Check }[] = [
  { id: 'role', label: 'Как у роли', icon: Minus },
  { id: 'allow', label: 'Разрешить', icon: Check },
  { id: 'deny', label: 'Запретить', icon: X },
];

/** Три положения, а не переключатель: «как у роли» значит следовать за правилом, если оно изменится. */
function ChoiceControl({ value, disabled, label, onChange }: { value: Choice; disabled: boolean; label: string; onChange: (next: Choice) => void }): JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-control border border-line bg-surface p-0.5">
      {CHOICES.map((choice) => {
        const Icon = choice.icon;
        const active = choice.id === value;
        const tone = !active ? 'text-ink-muted hover:text-ink'
          : choice.id === 'allow' ? 'bg-success-soft text-success'
            : choice.id === 'deny' ? 'bg-danger-soft text-danger'
              : 'bg-surface-muted text-ink';
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={choice.label}
            title={choice.label}
            disabled={disabled}
            onClick={() => { onChange(choice.id); }}
            className={`grid h-7 w-8 place-items-center rounded-[6px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/** Личные исключения одного человека. Роль задаёт основу, здесь видно только то, что отличается. */
export function UserPermissionsEditor({ userId }: { userId: string }): JSX.Element {
  const toast = useToast();
  const { data, isPending, error, refetch, set } = useUserPermissions(userId);

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}
      </div>
    );
  }

  if (error !== null || data === undefined) {
    return <ErrorState error={error} title="Не удалось загрузить права" onRetry={refetch} />;
  }

  if (data.permissions.length === 0) {
    return <p className="text-[13px] text-ink-muted">Владельца организации ограничить нельзя: иначе настройки могло бы быть некому вернуть.</p>;
  }

  const groups = [...new Set(data.permissions.map((row) => row.group))];
  const overrides = data.permissions.filter((row) => row.override !== null).length;

  function change(permission: string, next: Choice): void {
    const allowed = next === 'role' ? null : next === 'allow';
    set(permission, allowed).catch((failure: unknown) => {
      toast.error(failure instanceof Error ? failure.message : 'Не удалось изменить право');
    });
  }

  return (
    <div className="space-y-5">
      {!data.canEdit ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Права этого человека меняет владелец организации.
        </p>
      ) : (
        <p className="text-[12.5px] text-ink-muted">
          {overrides === 0 ? 'Сейчас всё как у роли. Измените только то, что должно отличаться.' : `Отличий от роли: ${String(overrides)}.`}
        </p>
      )}

      {groups.map((group) => (
        <section key={group}>
          <h4 className="mb-1 text-[12.5px] font-semibold text-ink-secondary">{PERMISSION_GROUP_LABEL[group] ?? group}</h4>
          <ul className="divide-y divide-divider">
            {data.permissions.filter((row) => row.group === group).map((row) => {
              const info = PERMISSION_INFO[row.key];
              const value: Choice = row.override === null ? 'role' : row.override ? 'allow' : 'deny';
              return (
                <li key={row.key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{info?.label ?? row.key}</p>
                    <p className="truncate text-[11.5px] text-ink-muted">
                      {row.override === null
                        ? (row.roleValue ? 'Разрешено ролью' : 'Закрыто для роли')
                        : row.override ? 'Разрешено лично' : 'Запрещено лично'}
                    </p>
                  </div>
                  <ChoiceControl value={value} disabled={!data.canEdit} label={info?.label ?? row.key} onChange={(next) => { change(row.key, next); }} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

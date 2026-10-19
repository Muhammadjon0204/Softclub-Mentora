import { Building2, Check, FolderKanban, ShieldCheck } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import type { AuthUser } from '../../api/auth';
import { Badge, StatusDot } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';
import { AVATAR_COLORS, roleLabel, writeAvatarColor } from './profilePresentation';
import { useAvatarColor } from './useAvatarColor';

function MetaRow({ icon: Icon, label, children }: { icon: ComponentType<{ className?: string }>; label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
      <span className="flex items-center gap-2 text-ink-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{children}</span>
    </div>
  );
}

/** Визитка: фото (или инициалы с выбором цвета), имя, email, роль и где человек работает. */
export function ProfileIdentityCard({ user }: { user: AuthUser }): JSX.Element {
  const color = useAvatarColor(user.id);
  const hasPhoto = (user.avatarUrl ?? null) !== null;
  const isOrgAdmin = user.role === 'Admin' && user.adminScope === 'Organization';
  const branch = isOrgAdmin ? 'Все филиалы' : (user.branch?.name ?? '—');
  const direction = user.category?.name ?? (user.role === 'Admin' ? 'Управление' : '—');

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
        <ProfileAvatarEditor user={user} />
        {/* Цвет нужен только инициалам: с фото его не видно, и выбор только сбивал бы с толку. */}
        <div className={`mt-3 flex items-center gap-1.5 ${hasPhoto ? 'hidden' : ''}`} role="radiogroup" aria-label="Цвет аватара">
          {AVATAR_COLORS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={color === option.id}
              aria-label={option.label}
              title={option.label}
              onClick={() => { writeAvatarColor(user.id, option.id); }}
              className={`grid h-5 w-5 place-items-center rounded-full text-white ring-offset-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${option.swatch} ${
                color === option.id ? 'ring-2 ring-line-strong' : 'hover:scale-110'
              }`}
            >
              {color === option.id ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[17px] font-semibold text-ink">{user.fullName}</p>
        <p className="text-[13px] text-ink-muted">{user.email}</p>
        <Badge tone="brand" className="mt-2.5">{roleLabel(user)}</Badge>
      </div>
      <div className="divide-y divide-divider border-t border-divider px-5">
        <MetaRow icon={Building2} label="Филиал">{branch}</MetaRow>
        <MetaRow icon={FolderKanban} label="Направление">{direction}</MetaRow>
        <MetaRow icon={ShieldCheck} label="Статус аккаунта">
          <Badge tone="success">
            <StatusDot tone="success" />
            Активен
          </Badge>
        </MetaRow>
      </div>
    </Card>
  );
}

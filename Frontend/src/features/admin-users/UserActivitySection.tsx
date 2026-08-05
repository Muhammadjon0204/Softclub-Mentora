import {
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Pencil,
  ShieldOff,
  UserCog,
  UserPlus,
  UserX,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import { Tooltip } from '../../shared/overlays';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { PreviewUserDetails, UserActivityEntry, UserActivityKind } from './userPresentation';

const KIND_META: Record<UserActivityKind, { icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }> = {
  created: { icon: UserPlus, tone: 'bg-brand-soft text-brand' },
  invited: { icon: Mail, tone: 'bg-info-soft text-info' },
  login: { icon: LogIn, tone: 'bg-surface-muted text-ink-secondary' },
  role_changed: { icon: UserCog, tone: 'bg-info-soft text-info' },
  branch_changed: { icon: UserCog, tone: 'bg-info-soft text-info' },
  category_changed: { icon: UserCog, tone: 'bg-info-soft text-info' },
  password_reset: { icon: KeyRound, tone: 'bg-warning-soft text-warning' },
  locked: { icon: Lock, tone: 'bg-warning-soft text-warning' },
  unlocked: { icon: ShieldOff, tone: 'bg-success-soft text-success' },
  deactivated: { icon: UserX, tone: 'bg-danger-soft text-danger' },
  profile_updated: { icon: Pencil, tone: 'bg-surface-muted text-ink-secondary' },
};

/** Компактная вертикальная timeline последних 5–8 событий (раздел 10 промпта). */
export function UserActivitySection({ user }: { user: PreviewUserDetails }): JSX.Element {
  const entries = user.activity.slice(0, 8);

  if (entries.length === 0) {
    return <EmptyState icon={<UserPlus className="h-5 w-5" aria-hidden="true" />} title="Активности пока нет" description="События появятся здесь по мере изменений." />;
  }

  return (
    <ol className="space-y-0.5">
      {entries.map((entry, index) => (
        <ActivityRow key={entry.id} entry={entry} isLast={index === entries.length - 1} />
      ))}
    </ol>
  );
}

function ActivityRow({ entry, isLast }: { entry: UserActivityEntry; isLast: boolean }): JSX.Element {
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast ? <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-divider" /> : null}
      <span aria-hidden="true" className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-medium text-ink">{entry.label}</p>
        {entry.detail !== undefined ? <p className="mt-0.5 text-[12px] text-ink-secondary">{entry.detail}</p> : null}
        <p className="mt-1 text-[11.5px] text-ink-muted">
          {entry.actorName} ·{' '}
          <Tooltip content={entry.absoluteLabel} placement="top">
            <span className="cursor-default">{entry.relativeTime}</span>
          </Tooltip>
        </p>
      </div>
    </li>
  );
}

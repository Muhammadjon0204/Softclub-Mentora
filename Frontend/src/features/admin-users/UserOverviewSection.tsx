import type { ReactNode } from 'react';

import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { branchDisplayName, emptyOrValue, NOTIFICATION_LANGUAGE_LABEL, ROLE_ICON, ROLE_TONE, STATUS_META } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';
import { STATUS_LABEL } from '../../mocks/ui-preview/users.preview';

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function DetailRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}

function scopeRows(user: PreviewUserDetails): { label: string; value: ReactNode }[] {
  if (user.role === 'OrgAdmin') {
    return [
      { label: 'Область доступа', value: 'Вся организация' },
      { label: 'Филиалы', value: 'Все филиалы' },
    ];
  }
  if (user.role === 'BranchAdmin') {
    return [{ label: 'Область доступа', value: branchDisplayName(user.branchName) }];
  }
  return [
    { label: 'Филиал', value: branchDisplayName(user.branchName) },
    { label: 'Направление', value: emptyOrValue(user.categoryName) },
  ];
}

/** Профильный summary — строгий блок, не цветная hero-card (раздел 7 промпта). */
export function UserOverviewSection({ user }: { user: PreviewUserDetails }): JSX.Element {
  const Icon = ROLE_ICON[user.role];
  const tone = ROLE_TONE[user.role];
  const statusMeta = STATUS_META[user.status];
  const lastLogin = user.lastLoginLabel === 'Ещё не входил' || user.lastLoginLabel === 'Никогда' ? null : user.lastLoginLabel;

  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Роль', value: ROLE_LABEL[user.role] },
    {
      label: 'Статус',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${statusMeta.dot}`} />
          <span className={statusMeta.text}>{STATUS_LABEL[user.status]}</span>
        </span>
      ),
    },
    ...scopeRows(user),
    { label: 'Язык уведомлений', value: NOTIFICATION_LANGUAGE_LABEL[user.notificationLanguage] },
    { label: 'Дата приглашения', value: user.invitedAtLabel },
    { label: 'Последний вход', value: emptyOrValue(lastLogin) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3.5 rounded-control border border-line bg-surface-muted p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[16px] font-semibold text-brand">
          {initialsOf(user.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{user.fullName}</p>
          <p className="truncate text-[12.5px] text-ink-muted">{user.email}</p>
        </div>
        <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-line ${tone.className}`} style={tone.style}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <dl className="divide-y divide-divider px-0.5">
        {rows.map((row) => (
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';

import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { accessSummaryFor, branchDisplayName, emptyOrValue } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';

/** Компактные 3–5 пунктов вместо полноценной permission matrix (раздел 8 промпта). */
export function UserAccessSection({ user }: { user: PreviewUserDetails }): JSX.Element {
  const summary = accessSummaryFor(user.role);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-control border border-line bg-surface p-3">
          <p className="text-[11.5px] text-ink-muted">Роль</p>
          <p className="mt-0.5 text-[13.5px] font-semibold text-ink">{ROLE_LABEL[user.role]}</p>
        </div>
        <div className="rounded-control border border-line bg-surface p-3">
          <p className="text-[11.5px] text-ink-muted">{user.role === 'OrgAdmin' ? 'Организация' : 'Филиал'}</p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-ink">
            {user.role === 'OrgAdmin' ? 'Вся организация' : branchDisplayName(user.branchName)}
          </p>
        </div>
        {user.role === 'Lead' || user.role === 'Mentor' ? (
          <div className="col-span-2 rounded-control border border-line bg-surface p-3">
            <p className="text-[11.5px] text-ink-muted">Направление</p>
            <p className="mt-0.5 text-[13.5px] font-semibold text-ink">{emptyOrValue(user.categoryName)}</p>
          </div>
        ) : null}
      </div>

      <div>
        <h4 className="mb-2.5 text-[12.5px] font-semibold text-ink-secondary">Текущие разрешения</h4>
        <ul className="space-y-2">
          {summary.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[13px] leading-[19px] text-ink-secondary">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

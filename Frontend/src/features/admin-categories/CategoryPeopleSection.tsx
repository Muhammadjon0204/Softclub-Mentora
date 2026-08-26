import { ExternalLink, UserCog } from 'lucide-react';

import { STATUS_LABEL } from '../../mocks/ui-preview/users.preview';
import { STATUS_META } from '../admin-users/userPresentation';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { PreviewCategoryDetails } from './categoryPresentation';

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

export interface CategoryPeopleSectionProps {
  category: PreviewCategoryDetails;
  canManage: boolean;
  onOpenUser: (userId: string) => void;
  onChangeLead: () => void;
}

/** Только пользователи этого Branch/Category — никакого доступа к чужому филиалу (раздел 7 промпта). */
export function CategoryPeopleSection({ category, canManage, onOpenUser, onChangeLead }: CategoryPeopleSectionProps): JSX.Element {
  const { users } = useUsersQuery();
  const lead = category.leadUserId !== null ? users.find((user) => user.id === category.leadUserId) : undefined;
  const mentors = users.filter((user) => user.role === 'Mentor' && user.categoryId === category.id);

  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-2.5 text-[12.5px] font-semibold text-ink-secondary">Руководитель направления</h4>
        {lead === undefined ? (
          <p className="rounded-control border border-line bg-surface-muted px-3 py-2.5 text-[13px] text-ink-muted">Не назначен</p>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => { onOpenUser(lead.id); }}
              className="flex w-full items-center gap-3 rounded-control border border-line bg-surface p-3 text-left transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand">{initialsOf(lead.fullName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{lead.fullName}</span>
                <span className="block truncate text-[12px] text-ink-muted">{lead.email}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                  <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${STATUS_META[lead.status].dot}`} />
                  <span className={STATUS_META[lead.status].text}>{STATUS_LABEL[lead.status]}</span>
                  <span className="text-ink-muted">· {lead.lastLoginLabel}</span>
                </span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            </button>
            {canManage ? (
              <Button variant="secondary" size="sm" leadingIcon={<UserCog className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onChangeLead}>
                Сменить руководителя
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2.5 text-[12.5px] font-semibold text-ink-secondary">Менторы ({mentors.length})</h4>
        {mentors.length === 0 ? (
          <EmptyState icon={<UserCog className="h-5 w-5" aria-hidden="true" />} title="Менторов пока нет" description="Менторы появятся здесь после назначения в направление." />
        ) : (
          <ul className="divide-y divide-divider rounded-control border border-line">
            {mentors.map((mentor) => (
              <li key={mentor.id}>
                <button
                  type="button"
                  onClick={() => { onOpenUser(mentor.id); }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-ink-secondary">{initialsOf(mentor.fullName)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{mentor.fullName}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                      <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${STATUS_META[mentor.status].dot}`} />
                      <span className={STATUS_META[mentor.status].text}>{STATUS_LABEL[mentor.status]}</span>
                      <span className="text-ink-muted">· {mentor.lastLoginLabel}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

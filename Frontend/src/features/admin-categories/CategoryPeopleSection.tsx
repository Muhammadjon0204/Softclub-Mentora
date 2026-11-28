import { ExternalLink, UserCog } from 'lucide-react';

import { STATUS_LABEL } from '../../mocks/ui-preview/users.preview';
import { STATUS_META } from '../admin-users/userPresentation';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import { Button } from '../../shared/ui/Button';
import type { PreviewCategoryDetails } from './categoryPresentation';
import { UserAvatar } from '../avatars/UserAvatar';
import { TeamMembersPanel } from '../teams/TeamMembersPanel';

export interface CategoryPeopleSectionProps {
  category: PreviewCategoryDetails;
  canManage: boolean;
  onOpenUser: (userId: string) => void;
  onChangeLead: () => void;
}

/** Руководитель и все участники команды — только люди её филиала. */
export function CategoryPeopleSection({ category, canManage, onOpenUser, onChangeLead }: CategoryPeopleSectionProps): JSX.Element {
  const { users } = useUsersQuery();
  const lead = category.leadUserId !== null ? users.find((user) => user.id === category.leadUserId) : undefined;

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
              <UserAvatar userId={lead.id} name={lead.fullName} size={null} className="h-10 w-10 text-[13px]" fallbackClassName="bg-brand-soft text-brand" />
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
            {category.leadIsMember === true ? (
              <p className="text-[12px] text-ink-muted">Руководитель добавлен в команду дополнительно. Сменить его можно в списке участников ниже.</p>
            ) : canManage ? (
              <Button variant="secondary" size="sm" leadingIcon={<UserCog className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onChangeLead}>
                Сменить руководителя
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <TeamMembersPanel categoryId={category.id} teamName={category.name} onOpenUser={onOpenUser} />
    </div>
  );
}

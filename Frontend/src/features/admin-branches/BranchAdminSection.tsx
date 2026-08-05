import { ExternalLink, UserCog, UserPlus } from 'lucide-react';

import { STATUS_LABEL } from '../../mocks/ui-preview/users.preview';
import { STATUS_META } from '../../features/admin-users/userPresentation';
import { getUserPreview } from '../admin-users/userPreviewStore';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { PreviewBranchDetails } from './branchPresentation';

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

export interface BranchAdminSectionProps {
  branch: PreviewBranchDetails;
  isOrgAdmin: boolean;
  onOpenUser: (userId: string) => void;
  onAssignAdmin: () => void;
  onChangeAdmin: () => void;
}

/** Компактный EmptyState вместо огромной warning-карточки при отсутствии администратора (раздел 25 промпта). */
export function BranchAdminSection({ branch, isOrgAdmin, onOpenUser, onAssignAdmin, onChangeAdmin }: BranchAdminSectionProps): JSX.Element {
  const admin = branch.adminUserId !== null ? getUserPreview(branch.adminUserId) : undefined;

  if (admin === undefined) {
    return (
      <EmptyState
        icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
        title="Администратор филиала не назначен"
        description="Назначьте пользователя, чтобы он мог управлять этим филиалом."
        action={isOrgAdmin ? <Button variant="primary" size="sm" onClick={onAssignAdmin}>Назначить администратора</Button> : undefined}
      />
    );
  }

  const statusMeta = STATUS_META[admin.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3.5 rounded-control border border-line bg-surface p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[15px] font-semibold text-brand">{initialsOf(admin.fullName)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{admin.fullName}</p>
          <p className="truncate text-[12.5px] text-ink-muted">{admin.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px]">
            <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${statusMeta.dot}`} />
            <span className={statusMeta.text}>{STATUS_LABEL[admin.status]}</span>
            <span className="text-ink-muted">· {admin.lastLoginLabel}</span>
          </p>
        </div>
      </div>

      {isOrgAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" leadingIcon={<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { onOpenUser(admin.id); }}>
            Открыть пользователя
          </Button>
          <Button variant="secondary" size="sm" leadingIcon={<UserCog className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onChangeAdmin}>
            Сменить администратора
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import {
  ArrowLeftRight,
  Eye,
  KeyRound,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  ShieldOff,
  UserCog,
  UserX,
} from 'lucide-react';

import { ActionMenu } from '../../shared/overlays';
import type { ActionMenuItem } from '../../shared/overlays';
import { IconButton } from '../../shared/ui/Button';
import type { PreviewUserDetails } from './userPresentation';

export interface UserActionMenuProps {
  user: PreviewUserDetails;
  /** В Details Drawer нет смысла показывать «Открыть профиль» — вы уже там. */
  context: 'row' | 'drawer';
  isOrgAdmin: boolean;
  onOpenProfile?: () => void;
  onEdit: () => void;
  onChangeRole: () => void;
  onTransfer: () => void;
  onResendInvitation: () => void;
  onRequestPasswordReset: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onDeactivate: () => void;
}

/**
 * Меню действий пользователя — единая логика видимости для table row и для
 * header Details Drawer (раздел 11 промпта). Недоступные по роли пункты не
 * рендерятся вовсе (не `disabled`) — Branch Admin просто не видит «Перевести
 * в другой филиал» и действия над Organization Admin.
 */
export function UserActionMenu({
  user,
  context,
  isOrgAdmin,
  onOpenProfile,
  onEdit,
  onChangeRole,
  onTransfer,
  onResendInvitation,
  onRequestPasswordReset,
  onBlock,
  onUnblock,
  onDeactivate,
}: UserActionMenuProps): JSX.Element {
  const isDeactivated = user.status === 'Deactivated';
  const canManageThisUser = isOrgAdmin || user.role !== 'OrgAdmin';

  const items: ActionMenuItem[] = [];

  if (context === 'row' && onOpenProfile !== undefined) {
    items.push({ id: 'open', label: 'Открыть профиль', icon: <Eye className="h-full w-full" aria-hidden="true" />, onSelect: onOpenProfile });
  }

  if (canManageThisUser) {
    items.push({ id: 'edit', label: 'Редактировать', icon: <Pencil className="h-full w-full" aria-hidden="true" />, onSelect: onEdit });

    if (!isDeactivated) {
      items.push({
        id: 'change-role',
        label: 'Изменить роль',
        icon: <UserCog className="h-full w-full" aria-hidden="true" />,
        onSelect: onChangeRole,
      });

      if (isOrgAdmin && user.role !== 'OrgAdmin') {
        items.push({
          id: 'transfer',
          label: 'Перевести в другой филиал',
          icon: <ArrowLeftRight className="h-full w-full" aria-hidden="true" />,
          onSelect: onTransfer,
        });
      }
    }

    const securityItems: ActionMenuItem[] = [];
    if (!user.passwordSet && user.status === 'Invited') {
      securityItems.push({
        id: 'resend-invitation',
        label: 'Повторно отправить приглашение',
        icon: <Mail className="h-full w-full" aria-hidden="true" />,
        onSelect: onResendInvitation,
      });
    }
    if (user.passwordSet && !isDeactivated) {
      securityItems.push({
        id: 'password-reset',
        label: 'Отправить ссылку сброса пароля',
        icon: <KeyRound className="h-full w-full" aria-hidden="true" />,
        onSelect: onRequestPasswordReset,
      });
    }
    if (user.status === 'Active') {
      securityItems.push({
        id: 'block',
        label: 'Заблокировать',
        icon: <Lock className="h-full w-full" aria-hidden="true" />,
        onSelect: onBlock,
      });
    }
    if (user.status === 'Locked') {
      securityItems.push({
        id: 'unblock',
        label: 'Разблокировать',
        icon: <ShieldOff className="h-full w-full" aria-hidden="true" />,
        onSelect: onUnblock,
      });
    }
    if (securityItems.length > 0) {
      securityItems[0] = { ...securityItems[0], separatorBefore: true };
      items.push(...securityItems);
    }

    if (!isDeactivated) {
      items.push({
        id: 'deactivate',
        label: 'Деактивировать',
        icon: <UserX className="h-full w-full" aria-hidden="true" />,
        destructive: true,
        separatorBefore: true,
        onSelect: onDeactivate,
      });
    }
  }

  if (items.length === 0) return <span className="inline-block h-8 w-8" aria-hidden="true" />;

  return (
    <ActionMenu
      align="end"
      ariaLabel={`Действия: ${user.fullName}`}
      panelClassName="w-64"
      trigger={
        <IconButton label={`Действия: ${user.fullName}`} size="sm">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      }
      items={items}
    />
  );
}

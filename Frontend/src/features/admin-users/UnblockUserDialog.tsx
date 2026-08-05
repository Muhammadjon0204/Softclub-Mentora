import { ConfirmDialog } from '../../shared/overlays';
import type { PreviewUserDetails } from './userPresentation';

export interface UnblockUserDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

export function UnblockUserDialog({ user, open, onOpenChange, isSubmitting, onConfirm }: UnblockUserDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Разблокировать пользователя?"
      description="Пользователь снова сможет войти в систему."
      details={user !== null ? <p className="text-[13px] font-medium text-ink">{user.fullName}</p> : undefined}
      confirmLabel="Разблокировать"
      loading={isSubmitting}
      onConfirm={async () => {
        if (user === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}

import { ConfirmDialog } from '../../shared/overlays';
import type { PreviewUserDetails } from './userPresentation';

export interface ResendInvitationDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

export function ResendInvitationDialog({ user, open, onOpenChange, isSubmitting, onConfirm }: ResendInvitationDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Отправить новое приглашение?"
      description="Предыдущая ссылка станет недействительной. Новая ссылка будет отправлена на email пользователя."
      details={user !== null ? <p className="text-[13px] font-medium text-ink">{user.email}</p> : undefined}
      confirmLabel="Отправить приглашение"
      loading={isSubmitting}
      onConfirm={async () => {
        if (user === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}

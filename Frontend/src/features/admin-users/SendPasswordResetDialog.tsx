import { ConfirmDialog } from '../../shared/overlays';
import type { PreviewUserDetails } from './userPresentation';

export interface SendPasswordResetDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

/** Admin не видит и не задаёт пароль (раздел 20 промпта) — только отправка одноразовой ссылки. */
export function SendPasswordResetDialog({ user, open, onOpenChange, isSubmitting, onConfirm }: SendPasswordResetDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Отправить ссылку сброса пароля?"
      description="Пользователь получит одноразовую ссылку для установки нового пароля."
      details={user !== null ? <p className="text-[13px] font-medium text-ink">{user.email}</p> : undefined}
      confirmLabel="Отправить ссылку"
      loading={isSubmitting}
      onConfirm={async () => {
        if (user === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}

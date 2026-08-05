import { DestructiveConfirmDialog } from '../../shared/overlays';

export type IntegrationKind = 'email' | 'telegram';

const CONSEQUENCES: Record<IntegrationKind, string[]> = {
  email: ['Приглашения не будут отправляться', 'Ссылки сброса пароля не будут доставляться', 'Сообщения останутся в Outbox согласно политике backend'],
  telegram: ['Telegram-уведомления перестанут доставляться', 'Email может продолжить работу отдельно'],
};

const NAME: Record<IntegrationKind, string> = { email: 'Email', telegram: 'Telegram' };

export interface DisconnectIntegrationDialogProps {
  integration: IntegrationKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

/** Раздел 33 промпта — без секретов интеграции, только последствия отключения. */
export function DisconnectIntegrationDialog({ integration, open, onOpenChange, isSubmitting, onConfirm }: DisconnectIntegrationDialogProps): JSX.Element {
  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={integration !== null ? `Отключить интеграцию «${NAME[integration]}»?` : 'Отключить интеграцию?'}
      description="Функции, зависящие от этой интеграции, станут недоступны до повторного подключения."
      confirmLabel="Отключить интеграцию"
      loading={isSubmitting}
      consequences={integration !== null ? CONSEQUENCES[integration] : undefined}
      onConfirm={async () => {
        if (integration === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}

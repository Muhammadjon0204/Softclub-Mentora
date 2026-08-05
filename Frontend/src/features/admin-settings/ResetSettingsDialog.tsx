import { ConfirmDialog } from '../../shared/overlays';

export interface ResetSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Warning tone, не destructive — это не удаление данных (раздел 32 промпта). */
export function ResetSettingsDialog({ open, onOpenChange, onConfirm }: ResetSettingsDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Сбросить изменения?"
      description="Поля вернутся к последним сохранённым значениям."
      tone="warning"
      confirmLabel="Сбросить"
      onConfirm={() => {
        onConfirm();
        onOpenChange(false);
      }}
    />
  );
}

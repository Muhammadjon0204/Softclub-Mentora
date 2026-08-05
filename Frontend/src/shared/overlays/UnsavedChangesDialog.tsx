import { ConfirmDialog } from './ConfirmDialog';

export interface UnsavedChangesDialogProps {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
  loading?: boolean;
}

/**
 * Готовый текст для несохранённых изменений (раздел 16 промпта). Router
 * integration (blocker/beforeunload) сюда не входит — это отдельный этап.
 */
export function UnsavedChangesDialog({ open, onStay, onDiscard, loading = false }: UnsavedChangesDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
      title="Есть несохранённые изменения"
      description="Изменения будут потеряны, если закрыть страницу без сохранения."
      cancelLabel="Остаться"
      confirmLabel="Выйти без сохранения"
      destructive
      loading={loading}
      onConfirm={onDiscard}
    />
  );
}

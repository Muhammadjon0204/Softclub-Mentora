import { ConfirmDialog } from '../../shared/overlays';

export interface ConcurrencyConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Например, «пользователя», «филиал» — подставляется в дефолтное описание. */
  entityLabel?: string;
  onRefresh: () => void;
}

/**
 * Заготовка под будущий PostgreSQL `xmin` / 409 `CONCURRENCY_CONFLICT` (раздел
 * 35 промпта). Сейчас ни с одним реальным API не связан — preview stores этого
 * этапа не проверяют конфликт версий. Никаких «Перезаписать» / «Сохранить всё
 * равно» — только отмена или обновление данных.
 */
export function ConcurrencyConflictDialog({ open, onOpenChange, entityLabel, onRefresh }: ConcurrencyConflictDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Данные были изменены"
      description={`Другой пользователь изменил ${entityLabel ?? 'эту запись'} после того, как вы открыли форму.`}
      confirmLabel="Обновить данные"
      cancelLabel="Отмена"
      onConfirm={() => {
        onRefresh();
        onOpenChange(false);
      }}
    />
  );
}

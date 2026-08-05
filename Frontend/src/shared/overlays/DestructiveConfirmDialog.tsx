import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { ConfirmDialog } from './ConfirmDialog';

export interface DestructiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  icon?: ReactNode;
  /** Компактный список последствий действия — не большие warning-карточки. */
  consequences?: string[];
  /** Если задано, confirm недоступен, пока пользователь не наберёт этот текст точь-в-точь. */
  confirmationText?: string;
  confirmationLabel?: string;
  /** Доп. форма перед consequences — например, select причины блокировки. */
  children?: ReactNode;
  /** Комбинируется с проверкой typed confirmation (например, обязательное поле причины не заполнено). */
  confirmDisabled?: boolean;
}

/**
 * Мягкий wrapper над ConfirmDialog для критических операций (деактивация,
 * блокировка). Не красит весь Modal в красный — только icon tile и текст
 * confirm-кнопки (раздел 15 промпта).
 */
export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Деактивировать',
  cancelLabel = 'Отмена',
  onConfirm,
  loading = false,
  icon,
  consequences,
  confirmationText,
  confirmationLabel = 'Введите текст подтверждения',
  children,
  confirmDisabled: externalConfirmDisabled = false,
}: DestructiveConfirmDialogProps): JSX.Element {
  const [typedConfirmation, setTypedConfirmation] = useState('');

  const confirmationRequired = confirmationText !== undefined && confirmationText.length > 0;
  const confirmDisabled = externalConfirmDisabled || (confirmationRequired && typedConfirmation !== confirmationText);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setTypedConfirmation('');
        onOpenChange(next);
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      loading={loading}
      icon={icon ?? <AlertTriangle className="h-[18px] w-[18px]" aria-hidden="true" />}
      tone="warning"
      destructive
      confirmDisabled={confirmDisabled}
      details={
        children !== undefined || (consequences !== undefined && consequences.length > 0) || confirmationRequired ? (
          <div className="space-y-3">
            {children}
            {consequences !== undefined && consequences.length > 0 ? (
              <ul className="space-y-1.5">
                {consequences.map((consequence) => (
                  <li key={consequence} className="flex items-start gap-2 text-[12.5px] leading-[18px] text-ink-secondary">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                    {consequence}
                  </li>
                ))}
              </ul>
            ) : null}
            {confirmationRequired ? (
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary">
                  {confirmationLabel} «{confirmationText}»
                </span>
                <input
                  type="text"
                  value={typedConfirmation}
                  onChange={(event) => {
                    setTypedConfirmation(event.target.value);
                  }}
                  autoComplete="off"
                  className="h-10 w-full rounded-control border border-line bg-surface px-3 text-[13px] text-ink outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
              </label>
            ) : null}
          </div>
        ) : undefined
      }
    />
  );
}

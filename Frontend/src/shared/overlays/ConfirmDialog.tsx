import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '../ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from './Modal';

export type ConfirmDialogTone = 'default' | 'warning';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  icon?: ReactNode;
  details?: ReactNode;
  tone?: ConfirmDialogTone;
  /** Кнопка Confirm рендерится как danger (используется DestructiveConfirmDialog). */
  destructive?: boolean;
  /** Отключает confirm-кнопку независимо от async-состояния (например, typed confirmation не введена). */
  confirmDisabled?: boolean;
}

const TONE_ICON_TILE: Record<ConfirmDialogTone, string> = {
  default: 'bg-brand-soft text-brand',
  warning: 'bg-warning-soft text-warning',
};

/**
 * Компактное подтверждение поверх Modal — смена роли, приглашения, короткие
 * решения (раздел 14 промпта). Во время async onConfirm обе кнопки блокируются,
 * Escape/backdrop отключаются, повторный submit невозможен.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  onConfirm,
  loading = false,
  icon,
  details,
  tone = 'default',
  destructive = false,
  confirmDisabled = false,
}: ConfirmDialogProps): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = loading || submitting;

  async function handleConfirm(): Promise<void> {
    if (isBusy) return;
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось выполнить действие. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        onOpenChange(next);
      }}
      title={title}
      size="sm"
      preventClose={isBusy}
      icon={
        icon !== undefined ? (
          <span className={`flex h-9 w-9 items-center justify-center rounded-control ${TONE_ICON_TILE[tone]}`}>{icon}</span>
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" disabled={isBusy} onClick={() => { onOpenChange(false); }}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={isBusy || confirmDisabled}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {isBusy ? <Spinner className="h-4 w-4" /> : null}
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-[13px] leading-[19px] text-ink-secondary">{description}</div>
        {details !== undefined ? <div className="text-[13px] leading-[19px] text-ink-secondary">{details}</div> : null}
        {error !== null ? (
          <p role="alert" className="rounded-control-sm border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

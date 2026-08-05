import { AlertTriangle, ArrowRight } from 'lucide-react';

import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';

export interface OperationBlockedDetail {
  label: string;
  value: string;
}

export interface OperationBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  reason: string;
  details?: OperationBlockedDetail[];
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Действие невозможно из-за зависимостей — например, `CATEGORY_HAS_ACTIVE_USERS`
 * или единственный администратор филиала (раздел 36 промпта). Не destructive
 * confirm: операция уже запрещена, подтверждать нечего.
 */
export function OperationBlockedDialog({ open, onOpenChange, title, reason, details, actionLabel, onAction }: OperationBlockedDialogProps): JSX.Element {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => { onOpenChange(false); }}>
            Закрыть
          </Button>
          {actionLabel !== undefined && onAction !== undefined ? (
            <Button variant="primary" trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <p className="pt-1.5 text-[13px] leading-[19px] text-ink-secondary">{reason}</p>
        </div>

        {details !== undefined && details.length > 0 ? (
          <dl className="divide-y divide-divider rounded-control border border-line px-3">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <dt className="text-ink-muted">{detail.label}</dt>
                <dd className="font-medium text-ink">{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Modal>
  );
}

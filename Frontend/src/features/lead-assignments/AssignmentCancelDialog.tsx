import { useEffect, useState } from 'react';

import { DestructiveConfirmDialog } from '../../shared/overlays';
import { FormField, FormTextarea } from '../../shared/ui/FormField';

export interface AssignmentCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  assignmentTitle: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
}

/** Причина отмены — обязательна, 5–500 символов (ASN-006/ASN-024). Переиспользуется для «Отменить» и «Отклонить предложение». */
export function AssignmentCancelDialog({ open, onOpenChange, title, assignmentTitle, confirmLabel, onConfirm }: AssignmentCancelDialogProps): JSX.Element {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const invalid = trimmed.length > 0 && (trimmed.length < 5 || trimmed.length > 500);
  const confirmDisabled = trimmed.length < 5 || trimmed.length > 500;

  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={<>«{assignmentTitle}» — действие необратимо. Существующие решения и история сохранятся и останутся доступны для чтения.</>}
      confirmLabel={confirmLabel}
      loading={submitting}
      confirmDisabled={confirmDisabled}
      onConfirm={() => {
        setSubmitting(true);
        try {
          onConfirm(trimmed);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <FormField label="Причина" htmlFor="cancel-reason" required error={invalid ? 'От 5 до 500 символов' : undefined} hint="Видна в истории задания">
        <FormTextarea id="cancel-reason" rows={3} value={reason} onChange={(event) => { setReason(event.target.value); }} invalid={invalid} />
      </FormField>
    </DestructiveConfirmDialog>
  );
}

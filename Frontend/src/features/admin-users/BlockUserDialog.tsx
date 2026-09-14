import { useEffect, useState } from 'react';

import { DestructiveConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect, FormTextarea } from '../../shared/ui/FormField';
import type { PreviewUserDetails } from './userPresentation';

export interface BlockUserInput {
  reason: string;
  comment: string | null;
}

const BLOCK_REASONS = [
  { value: 'suspicious', label: 'Подозрительная активность' },
  { value: 'violation', label: 'Нарушение правил' },
  { value: 'temporary', label: 'Временное ограничение' },
  { value: 'other', label: 'Другое' },
] as const;

type BlockReasonValue = (typeof BLOCK_REASONS)[number]['value'];

export interface BlockUserDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (input: BlockUserInput) => Promise<void>;
}

/** DestructiveConfirmDialog + причина/комментарий (раздел 21 промпта). Typed confirmation не требуется. */
export function BlockUserDialog({ user, open, onOpenChange, isSubmitting, onConfirm }: BlockUserDialogProps): JSX.Element {
  const [reasonValue, setReasonValue] = useState<BlockReasonValue>('suspicious');
  const [otherText, setOtherText] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) return;
    setReasonValue('suspicious');
    setOtherText('');
    setComment('');
  }, [open, user?.id]);

  const isOther = reasonValue === 'other';
  const otherMissing = isOther && otherText.trim().length === 0;
  const reasonLabel = BLOCK_REASONS.find((entry) => entry.value === reasonValue)?.label ?? '';
  const finalReason = isOther ? otherText.trim() : reasonLabel;

  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Заблокировать пользователя?"
      description={
        <>
          <span className="font-medium text-ink">{user?.fullName}</span> не сможет войти в систему до разблокировки.
        </>
      }
      confirmLabel="Заблокировать"
      loading={isSubmitting}
      confirmDisabled={user === null || otherMissing}
      consequences={['Пользователь не сможет войти', 'Активные сессии будут завершены', 'Данные пользователя не удаляются']}
      onConfirm={async () => {
        if (user === null) return;
        await onConfirm({ reason: finalReason, comment: comment.trim().length > 0 ? comment.trim() : null });
        onOpenChange(false);
      }}
    >
      <FormField label="Причина блокировки" htmlFor="block-reason">
        <FormSelect
          id="block-reason"
          value={reasonValue}
          onValueChange={(next) => { setReasonValue(next as BlockReasonValue); }}
          options={BLOCK_REASONS.map((entry) => ({ value: entry.value, label: entry.label }))}
        />
      </FormField>

      {isOther ? (
        <FormField label="Опишите причину" htmlFor="block-other-reason" required error={otherMissing ? 'Обязательное поле' : undefined} className="mt-4">
          <FormTextarea
            id="block-other-reason"
            value={otherText}
            onChange={(event) => {
              setOtherText(event.target.value);
            }}
            placeholder="Опишите причину блокировки"
          />
        </FormField>
      ) : null}

      <FormField label="Дополнительный комментарий" htmlFor="block-comment" hint="Необязательно" className="mt-4">
        <FormTextarea
          id="block-comment"
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
          }}
          placeholder="Детали для истории — необязательно"
        />
      </FormField>
    </DestructiveConfirmDialog>
  );
}

import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ProposalDto } from '../../api/proposals';
import { Modal, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { DatePicker } from '../../shared/ui/DatePicker';
import { FormField, FormInput, FormTextarea } from '../../shared/ui/FormField';
import { TimePicker } from '../../shared/ui/TimePicker';
import { todayKey } from '../../lib/dayKeys';
import { localInputToUtcMs, toDateInputValue } from '../lead/scope/leadDateFormat';
import { useCategoryTimeZone, useProposalActions } from './useProposals';

const DEFAULT_DUE_TIME = '23:59';
const COMMENT_MAX = 500;
const REJECT_MIN = 5;

export type ProposalDecision = 'approve' | 'reject';

export interface ProposalDecisionDialogProps {
  proposal: ProposalDto | null;
  decision: ProposalDecision;
  onClose: () => void;
}

/**
 * Решение по предложению. Принятие — это выдача задания, поэтому здесь задаётся срок, а название и
 * описание можно уточнить. Отказ требует причину: ментор должен понять, что изменить в следующий раз.
 */
export function ProposalDecisionDialog({ proposal, decision, onClose }: ProposalDecisionDialogProps): JSX.Element {
  const toast = useToast();
  const actions = useProposalActions();
  const timeZoneId = useCategoryTimeZone(proposal?.categoryId ?? null);

  const [date, setDate] = useState('');
  const [time, setTime] = useState(DEFAULT_DUE_TIME);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (proposal === null) return;
    setDate(proposal.preferredAt ? toDateInputValue(Date.parse(proposal.preferredAt), timeZoneId) : '');
    setTime(DEFAULT_DUE_TIME);
    setTitle(proposal.title);
    setComment('');
  }, [proposal, timeZoneId]);

  const dueMs = useMemo(() => (date.length > 0 ? localInputToUtcMs(date, time, timeZoneId) : null), [date, time, timeZoneId]);
  const dueValid = dueMs !== null && dueMs > Date.now();
  const titleValid = title.trim().length >= 3;
  const commentLength = comment.trim().length;
  const canApprove = dueValid && titleValid;
  const canReject = commentLength >= REJECT_MIN;

  async function handleConfirm(): Promise<void> {
    if (proposal === null) return;
    try {
      if (decision === 'approve') {
        if (dueMs === null) return;
        await actions.approve(proposal, {
          dueAt: new Date(dueMs).toISOString(),
          title: title.trim() !== proposal.title ? title.trim() : null,
          description: null,
          comment: commentLength > 0 ? comment.trim() : null,
        });
        toast.success(`Принято: у автора появилось задание`);
      } else {
        await actions.reject(proposal, comment.trim());
        toast.success('Предложение отклонено, автор получит уведомление');
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить решение');
    }
  }

  const isApprove = decision === 'approve';

  return (
    <Modal
      open={proposal !== null}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={isApprove ? 'Принять предложение' : 'Отклонить предложение'}
      description={proposal !== null ? `${proposal.authorFullName}: «${proposal.title}»` : undefined}
      preventClose={actions.isSubmitting}
      icon={isApprove ? <Check className="h-5 w-5" aria-hidden="true" /> : <X className="h-5 w-5" aria-hidden="true" />}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={actions.isSubmitting} onClick={onClose}>Отмена</Button>
          <Button
            variant={isApprove ? 'primary' : 'danger'}
            isLoading={actions.isSubmitting}
            disabled={isApprove ? !canApprove : !canReject}
            onClick={() => { void handleConfirm(); }}
          >
            {isApprove ? 'Принять и выдать задание' : 'Отклонить'}
          </Button>
        </div>
      }
    >
      {isApprove ? (
        <div className="space-y-4">
          <FormField label="Название задания" htmlFor="decision-title" required error={!titleValid ? 'Не менее 3 символов' : undefined}>
            <FormInput id="decision-title" value={title} maxLength={200} invalid={!titleValid} onChange={(event) => { setTitle(event.target.value); }} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <FormField
              label="Срок"
              htmlFor="decision-date"
              required
              error={dueMs !== null && !dueValid ? 'Срок должен быть в будущем' : undefined}
              hint={`Часовой пояс: ${timeZoneId}`}
            >
              <DatePicker id="decision-date" value={date} onChange={setDate} min={todayKey()} invalid={dueMs !== null && !dueValid} />
            </FormField>
            <FormField label="Время" htmlFor="decision-time" required>
              <TimePicker id="decision-time" value={time} onChange={setTime} />
            </FormField>
          </div>
          <FormField label="Комментарий автору" htmlFor="decision-comment" hint="Необязательно">
            <FormTextarea id="decision-comment" rows={2} maxLength={COMMENT_MAX} value={comment} onChange={(event) => { setComment(event.target.value); }} />
          </FormField>
        </div>
      ) : (
        <FormField label="Причина" htmlFor="decision-reason" required hint="Автор увидит её в уведомлении и в своём предложении">
          <FormTextarea id="decision-reason" rows={4} maxLength={COMMENT_MAX} value={comment} onChange={(event) => { setComment(event.target.value); }} />
        </FormField>
      )}
    </Modal>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Drawer, UnsavedChangesDialog } from '../../../shared/overlays';
import { Button } from '../../../shared/ui/Button';
import { FormBannerError, FormField, FormInput, FormTextarea } from '../../../shared/ui/FormField';
import type { LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { formatCategoryDate, leadNow } from '../scope/leadDateFormat';
import { useLeadScope } from '../scope/useLeadScope';
import { useTopicActions } from './useTopicActions';
import { topicSchema } from './topicForm.schema';
import type { TopicFormValues } from './topicForm.schema';

const FORM_ID = 'lead-topic-form';

export interface TopicFormDrawerProps {
  open: boolean;
  existing?: LeadTopicRecord;
  onClose: () => void;
}

function toDateInputValue(ms: number, timeZoneId: string): string {
  const [day, month, year] = formatCategoryDate(ms, timeZoneId).split('.');
  return `${year}-${month}-${day}`;
}

/** TOPIC-011: дата в прошлом допустима (расписание регулярно заполняется задним числом) — только мягкое предупреждение, без блокировки. */
export function TopicFormDrawer({ open, existing, onClose }: TopicFormDrawerProps): JSX.Element {
  const scope = useLeadScope();
  const { isSubmitting, createTopic, updateTopic } = useTopicActions();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  const existingPlannedDateInput = existing !== undefined && existing.plannedDate !== null ? toDateInputValue(existing.plannedDate, scope.timeZoneId) : '';

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<TopicFormValues>({
    resolver: zodResolver(topicSchema),
    defaultValues: {
      dayNumber: existing?.dayNumber ?? 1,
      plannedDate: existingPlannedDateInput,
      title: existing?.title ?? '',
      description: existing?.description ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        dayNumber: existing?.dayNumber ?? 1,
        plannedDate: existing !== undefined && existing.plannedDate !== null ? toDateInputValue(existing.plannedDate, scope.timeZoneId) : '',
        title: existing?.title ?? '',
        description: existing?.description ?? '',
      });
      setBannerError(null);
      setUnsavedOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const plannedDateValue = watch('plannedDate');
  const isPastDate = plannedDateValue.length > 0 && new Date(`${plannedDateValue}T00:00:00Z`).getTime() < leadNow() - 24 * 60 * 60 * 1000;

  function requestClose(): void {
    if (isSubmitting) return;
    if (isDirty) { setUnsavedOpen(true); return; }
    onClose();
  }

  async function submit(values: TopicFormValues): Promise<void> {
    setBannerError(null);
    const plannedDateMs = values.plannedDate.length > 0 ? new Date(`${values.plannedDate}T00:00:00Z`).getTime() : null;
    try {
      if (existing !== undefined) {
        await updateTopic(existing.id, existing.concurrencyToken ?? '', { dayNumber: values.dayNumber, plannedDate: plannedDateMs, title: values.title, description: values.description ?? '' });
      } else {
        await createTopic({ dayNumber: values.dayNumber, plannedDate: plannedDateMs, title: values.title, description: values.description ?? '' });
      }
      onClose();
    } catch (error) {
      // TP3/TP4 fix: a duplicate `plannedDate`/`dayNumber` now surfaces here as a real blocking 409
      // RESOURCE_ALREADY_EXISTS (see `useTopicActions.ts`) — shown as this banner error, not silently
      // accepted the way the old preview store's incorrect "soft warning" comment implied.
      setBannerError(error instanceof Error ? error.message : 'Не удалось сохранить тему');
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => { if (!next) requestClose(); }}
        title={existing !== undefined ? 'Редактировать тему' : 'Новая тема'}
        size="md"
        preventClose={isSubmitting}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" disabled={isSubmitting} onClick={requestClose}>Отмена</Button>
            <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>{existing !== undefined ? 'Сохранить' : 'Создать'}</Button>
          </div>
        }
      >
        <form id={FORM_ID} noValidate onSubmit={(event) => { void handleSubmit(submit)(event); }} className="space-y-5">
          {bannerError !== null ? <FormBannerError message={bannerError} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="День курса" htmlFor="topic-day" required error={errors.dayNumber?.message}>
              <FormInput id="topic-day" type="number" min={1} invalid={errors.dayNumber !== undefined} {...register('dayNumber')} />
            </FormField>
            <FormField label="Плановая дата" htmlFor="topic-date" hint="Необязательно">
              <FormInput id="topic-date" type="date" {...register('plannedDate')} />
            </FormField>
          </div>
          {isPastDate ? <p className="text-[12px] text-warning">Дата в прошлом — это допустимо при переносе расписания.</p> : null}

          <FormField label="Название" htmlFor="topic-title" required error={errors.title?.message}>
            <FormInput id="topic-title" invalid={errors.title !== undefined} {...register('title')} />
          </FormField>

          <FormField label="Описание" htmlFor="topic-description" error={errors.description?.message} hint="До 2000 символов">
            <FormTextarea id="topic-description" rows={4} {...register('description')} />
          </FormField>
        </form>
      </Drawer>

      <UnsavedChangesDialog open={unsavedOpen} onStay={() => { setUnsavedOpen(false); }} onDiscard={() => { setUnsavedOpen(false); onClose(); }} />
    </>
  );
}

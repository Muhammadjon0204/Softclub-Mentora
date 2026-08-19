import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Modal } from '../../../shared/overlays';
import { Button } from '../../../shared/ui/Button';
import { FormCheckbox, FormField, FormInput, FormSelect, FormTextarea } from '../../../shared/ui/FormField';
import type { LeadTopicAssignmentRecord, TopicAssignmentType } from '../../../mocks/ui-preview/leadTopics.preview';
import { TOPIC_ASSIGNMENT_TYPE_LABEL } from '../../../mocks/ui-preview/leadTopics.preview';
import { topicAssignmentSchema } from './topicForm.schema';
import type { TopicAssignmentFormValues } from './topicForm.schema';

const TYPE_OPTIONS: TopicAssignmentType[] = ['Presentation', 'ClassTask', 'HomeTask'];

export interface TopicAssignmentFormModalProps {
  open: boolean;
  existing?: LeadTopicAssignmentRecord;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TopicAssignmentFormValues) => void;
}

export function TopicAssignmentFormModal({ open, existing, onOpenChange, onSubmit }: TopicAssignmentFormModalProps): JSX.Element {
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<TopicAssignmentFormValues>({
    resolver: zodResolver(topicAssignmentSchema),
    defaultValues: { type: existing?.type ?? 'HomeTask', title: existing?.title ?? '', description: existing?.description ?? '', isRequired: existing?.isRequired ?? true },
  });

  useEffect(() => {
    if (open) reset({ type: existing?.type ?? 'HomeTask', title: existing?.title ?? '', description: existing?.description ?? '', isRequired: existing?.isRequired ?? true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={existing !== undefined ? 'Редактировать шаблон' : 'Новый шаблон задания'} size="md">
      <form
        id="topic-assignment-form"
        noValidate
        onSubmit={(event) => { void handleSubmit((values) => { onSubmit(values); onOpenChange(false); })(event); }}
        className="space-y-4"
      >
        <FormField label="Тип" htmlFor="tpa-type" required>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <FormSelect
                id="tpa-type"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                options={TYPE_OPTIONS.map((type) => ({ value: type, label: TOPIC_ASSIGNMENT_TYPE_LABEL[type] }))}
              />
            )}
          />
        </FormField>
        <FormField label="Название" htmlFor="tpa-title" required error={errors.title?.message}>
          <FormInput id="tpa-title" invalid={errors.title !== undefined} {...register('title')} />
        </FormField>
        <FormField label="Описание" htmlFor="tpa-description" error={errors.description?.message}>
          <FormTextarea id="tpa-description" rows={3} {...register('description')} />
        </FormField>
        <FormCheckbox label="Обязательное задание" description="Участвует в авто-генерации предложений" {...register('isRequired')} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => { onOpenChange(false); }}>Отмена</Button>
          <Button type="submit" variant="primary">{existing !== undefined ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </form>
    </Modal>
  );
}

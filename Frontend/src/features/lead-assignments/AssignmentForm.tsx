import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { formatCategoryDate, leadNow, localInputToUtcMs } from '../lead/scope/leadDateFormat';
import { scopedActiveMentors, scopedTopics, scopedTopicAssignments } from '../lead/scope/leadScopedData';
import { useLeadScope } from '../lead/scope/useLeadScope';
import { FormBannerError, FormField, FormInput, FormSelect, FormTextarea, fieldA11yProps } from '../../shared/ui/FormField';
import { createAssignmentSchema, DEFAULT_DUE_TIME_LOCAL } from './createAssignment.schema';
import type { CreateAssignmentFormValues } from './createAssignment.schema';

export interface AssignmentFormProps {
  formId: string;
  /** `undefined` — создание; заполненное значение — редактирование Draft/Suggested (ASN-004). */
  existing?: LeadAssignmentRecord;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: { title: string; description: string; mentorId: string; dueAtMs: number; topicAssignmentId: string | null }) => void;
}

function toDateInputValue(ms: number, timeZoneId: string): string {
  const label = formatCategoryDate(ms, timeZoneId);
  const [day, month, year] = label.split('.');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(ms: number, timeZoneId: string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: timeZoneId, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(ms);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '23';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '59';
  return `${hour}:${minute}`;
}

/**
 * Форма Draft Assignment — общая для создания и редактирования (ASN-001,
 * ASN-004). Category/Branch не входят в форму: они фиксированы scope Lead
 * (раздел 21 задачи Phase 3). Mentor — только активные менторы своей
 * категории (10.6, composite FK); список закрыт до отрисовки, поэтому
 * ментора другой категории физически нельзя выбрать даже через DevTools.
 */
export function AssignmentForm({ formId, existing, bannerError, onDirtyChange, onSubmit }: AssignmentFormProps): JSX.Element {
  const scope = useLeadScope();
  const mentors = scopedActiveMentors(scope.categoryId);
  // TPL-003: архивный TopicAssignment недоступен для создания новых Assignment — только активная тема + активный шаблон.
  const topics = scopedTopics(scope.categoryId).filter((topic) => topic.isActive);
  const topicAssignmentOptions = topics.flatMap((topic) =>
    scopedTopicAssignments(scope.categoryId, topic.id)
      .filter((tpa) => tpa.isActive)
      .map((tpa) => ({ id: tpa.id, label: `${topic.title} — ${tpa.title}`, title: tpa.title, description: tpa.description })),
  );

  const defaultDueDate = toDateInputValue(existing?.initialDueAt ?? leadNow() + 3 * 24 * 60 * 60 * 1000, scope.timeZoneId);
  const defaultDueTime = existing !== undefined ? toTimeInputValue(existing.initialDueAt, scope.timeZoneId) : DEFAULT_DUE_TIME_LOCAL;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting: formSubmitting },
  } = useForm<CreateAssignmentFormValues>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      topicAssignmentId: existing?.topicAssignmentId ?? '',
      title: existing?.title ?? '',
      description: existing?.description ?? '',
      mentorId: existing?.mentorId ?? '',
      dueDate: defaultDueDate,
      dueTime: defaultDueTime,
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const selectedTopicAssignmentId = watch('topicAssignmentId');

  function handleTemplateChange(id: string): void {
    setValue('topicAssignmentId', id, { shouldDirty: true });
    const template = topicAssignmentOptions.find((option) => option.id === id);
    if (template !== undefined) {
      setValue('title', template.title, { shouldDirty: true });
      setValue('description', template.description, { shouldDirty: true });
    }
  }

  function submit(values: CreateAssignmentFormValues): void {
    const dueAtMs = localInputToUtcMs(values.dueDate, values.dueTime, scope.timeZoneId);
    if (dueAtMs === null || dueAtMs <= leadNow()) return;
    onSubmit({
      title: values.title,
      description: values.description ?? '',
      mentorId: values.mentorId,
      dueAtMs,
      topicAssignmentId: values.topicAssignmentId.length > 0 ? values.topicAssignmentId : null,
    });
  }

  const dueInPast = (() => {
    const raw = watch(['dueDate', 'dueTime']);
    const ms = localInputToUtcMs(raw[0], raw[1], scope.timeZoneId);
    return ms !== null && ms <= leadNow();
  })();

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
      className="space-y-5"
    >
      {bannerError !== null ? <FormBannerError message={bannerError} /> : null}

      <FormField label="Тема расписания" htmlFor="af-topic" hint="Необязательно — можно создать индивидуальное задание вне расписания">
        <FormSelect
          id="af-topic"
          value={selectedTopicAssignmentId}
          onValueChange={handleTemplateChange}
          options={[
            { value: '', label: 'Индивидуальное задание' },
            ...topicAssignmentOptions.map((option) => ({ value: option.id, label: option.label })),
          ]}
        />
      </FormField>

      <FormField label="Название" htmlFor="af-title" required error={errors.title?.message}>
        <FormInput id="af-title" invalid={errors.title !== undefined} {...fieldA11yProps('af-title', errors.title?.message)} {...register('title')} />
      </FormField>

      <FormField label="Описание" htmlFor="af-description" error={errors.description?.message} hint="До 2000 символов">
        <FormTextarea id="af-description" rows={4} invalid={errors.description !== undefined} {...register('description')} />
      </FormField>

      <FormField label="Ментор" htmlFor="af-mentor" required error={errors.mentorId?.message} hint={mentors.length === 0 ? 'В направлении пока нет активных менторов' : undefined}>
        <Controller
          control={control}
          name="mentorId"
          render={({ field }) => (
            <FormSelect
              id="af-mentor"
              invalid={errors.mentorId !== undefined}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              options={[
                { value: '', label: 'Выберите ментора' },
                ...mentors.map((mentor) => ({ value: mentor.id, label: mentor.fullName })),
              ]}
            />
          )}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Дедлайн" htmlFor="af-due-date" required error={errors.dueDate?.message}>
          <FormInput id="af-due-date" type="date" invalid={errors.dueDate !== undefined} {...register('dueDate')} />
        </FormField>
        <FormField label="Время" htmlFor="af-due-time" required error={errors.dueTime?.message} hint={`По умолчанию ${DEFAULT_DUE_TIME_LOCAL}`}>
          <FormInput id="af-due-time" type="time" invalid={errors.dueTime !== undefined} {...register('dueTime')} />
        </FormField>
      </div>
      {dueInPast ? <FormBannerError message="Дедлайн не может быть в прошлом" /> : null}
      <p className="text-[11.5px] text-ink-muted">Часовой пояс направления: {scope.timeZoneId}</p>

      <button type="submit" hidden disabled={formSubmitting} aria-hidden="true" />
    </form>
  );
}

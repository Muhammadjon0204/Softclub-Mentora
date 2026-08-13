import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Drawer, UnsavedChangesDialog } from '../../../shared/overlays';
import { Button } from '../../../shared/ui/Button';
import { FormBannerError, FormField, FormInput, ReadOnlyField, fieldA11yProps } from '../../../shared/ui/FormField';
import { useLeadScope } from '../scope/useLeadScope';
import { createMentorSchema } from './createMentor.schema';
import type { CreateMentorFormValues } from './createMentor.schema';
import { LeadMentorPreviewError, createMentorPreview } from './leadMentorPreviewStore';

const FORM_ID = 'lead-create-mentor-form';

export interface CreateMentorDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** «Добавить ментора» — Branch/Category read-only показаны как контекст, не как выбор (раздел 32 задачи Phase 3). */
export function CreateMentorDrawer({ open, onClose }: CreateMentorDrawerProps): JSX.Element {
  const scope = useLeadScope();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CreateMentorFormValues>({ resolver: zodResolver(createMentorSchema), defaultValues: { fullName: '', email: '' } });

  useEffect(() => {
    if (open) {
      reset({ fullName: '', email: '' });
      setBannerError(null);
      setUnsavedOpen(false);
    }
  }, [open, reset]);

  function requestClose(): void {
    if (isSubmitting) return;
    if (isDirty) {
      setUnsavedOpen(true);
      return;
    }
    onClose();
  }

  function submit(values: CreateMentorFormValues): void {
    setBannerError(null);
    try {
      createMentorPreview({ categoryId: scope.categoryId, branchId: scope.branchId, fullName: values.fullName, email: values.email });
      onClose();
    } catch (error) {
      setBannerError(error instanceof LeadMentorPreviewError ? error.message : 'Не удалось создать пользователя');
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => { if (!next) requestClose(); }}
        title="Добавить ментора"
        description="Пользователь получит приглашение для установки пароля"
        size="md"
        preventClose={isSubmitting}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" disabled={isSubmitting} onClick={requestClose}>Отмена</Button>
            <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>Создать</Button>
          </div>
        }
      >
        <form
          id={FORM_ID}
          noValidate
          onSubmit={(event) => { void handleSubmit(submit)(event); }}
          className="space-y-5"
        >
          {bannerError !== null ? <FormBannerError message={bannerError} /> : null}

          <FormField label="Имя и фамилия" htmlFor="cm-fullname" required error={errors.fullName?.message}>
            <FormInput id="cm-fullname" invalid={errors.fullName !== undefined} {...fieldA11yProps('cm-fullname', errors.fullName?.message)} {...register('fullName')} />
          </FormField>

          <FormField label="Email" htmlFor="cm-email" required error={errors.email?.message}>
            <FormInput id="cm-email" type="email" invalid={errors.email !== undefined} {...fieldA11yProps('cm-email', errors.email?.message)} {...register('email')} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Направление" value={scope.categoryName} />
            <ReadOnlyField label="Филиал" value={scope.branchDisplayName} />
          </div>
          <p className="text-[11.5px] text-ink-muted">Роль (Ментор), филиал и направление определяются автоматически — ваши.</p>
        </form>
      </Drawer>

      <UnsavedChangesDialog
        open={unsavedOpen}
        onStay={() => { setUnsavedOpen(false); }}
        onDiscard={() => { setUnsavedOpen(false); onClose(); }}
      />
    </>
  );
}

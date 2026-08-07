import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useUsersPreview } from '../admin-users/userPreviewStore';
import { SearchSelect } from '../../shared/select';
import { FormBannerError, FormCheckbox, FormField, FormInput, FormSection, FormSelect, FormTextarea, ReadOnlyField, fieldA11yProps } from '../../shared/ui/FormField';
import { BRANCH_DIRECTORY } from '../admin-preview/branchDirectory';
import { CATEGORY_CREATE_DEFAULTS, categoryCreateSchema, categoryEditSchema } from './categoryForm.schema';
import type { CategoryCreateFormValues, CategoryEditFormValues } from './categoryForm.schema';
import { TIMEZONE_OPTIONS } from './categoryPresentation';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface CategoryCreateFormProps {
  formId: string;
  isOrgAdmin: boolean;
  currentBranchRawName: string | null;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: CategoryCreateFormValues, helpers: { setNameError: (message: string) => void }) => void | Promise<void>;
}

/** Секции раздела 9 промпта: Основная информация → Руководитель → Настройки задания. */
export function CategoryCreateForm({ formId, isOrgAdmin, currentBranchRawName, bannerError, onDirtyChange, onSubmit }: CategoryCreateFormProps): JSX.Element {
  const users = useUsersPreview();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<CategoryCreateFormValues>({
    resolver: zodResolver(categoryCreateSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      description: '',
      branchName: isOrgAdmin ? '' : (currentBranchRawName ?? ''),
      leadUserId: '',
      ...CATEGORY_CREATE_DEFAULTS,
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const branchName = watch('branchName');
  const leadCandidates = users.filter((user) => user.role === 'Mentor' && user.status === 'Active' && user.branchName === branchName);

  useEffect(() => {
    setValue('leadUserId', '', { shouldValidate: false, shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сбрасываем именно при смене branchName
  }, [branchName]);

  const submit = handleSubmit((values) => {
    void onSubmit(values, { setNameError: (message) => { setError('name', { type: 'server', message }); } });
  });

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      {bannerError !== null ? <FormBannerError message={bannerError} /> : null}

      <FormSection title="Основная информация">
        <div className="space-y-4">
          <FormField label="Название" htmlFor="category-create-name" required error={errors.name?.message}>
            <FormInput id="category-create-name" placeholder="Например, Data Science" invalid={errors.name !== undefined} {...fieldA11yProps('category-create-name', errors.name?.message)} {...register('name')} />
          </FormField>
          <FormField label="Описание" htmlFor="category-create-description" error={errors.description?.message} hint="Необязательно">
            <FormTextarea id="category-create-description" placeholder="Кратко опишите направление" invalid={errors.description !== undefined} {...register('description')} />
          </FormField>
          {isOrgAdmin ? (
            <FormField label="Филиал" htmlFor="category-create-branch" required error={errors.branchName?.message}>
              <Controller
                control={control}
                name="branchName"
                render={({ field }) => (
                  <FormSelect
                    id="category-create-branch"
                    invalid={errors.branchName !== undefined}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="Выберите филиал"
                    options={BRANCH_DIRECTORY.map((branch) => ({ value: branch.rawName, label: branch.displayName }))}
                  />
                )}
              />
            </FormField>
          ) : (
            <ReadOnlyField label="Филиал" value={BRANCH_DIRECTORY.find((branch) => branch.rawName === currentBranchRawName)?.displayName ?? '—'} hint="Ваш филиал — изменить нельзя" />
          )}
        </div>
      </FormSection>

      <FormSection title="Руководитель" description="Можно назначить сейчас или отдельным действием позже">
        <FormField label="Руководитель направления" htmlFor="category-create-lead" hint={branchName.length === 0 ? 'Сначала выберите филиал' : undefined}>
          <Controller
            control={control}
            name="leadUserId"
            render={({ field }) => (
              <SearchSelect
                id="category-create-lead"
                disabled={branchName.length === 0}
                value={field.value ?? ''}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                placeholder="Не назначать сейчас"
                searchPlaceholder="Поиск по имени или email…"
                options={leadCandidates.map((candidate) => ({ value: candidate.id, label: candidate.fullName, description: candidate.email }))}
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title="Настройки задания">
        <div className="space-y-4">
          <FormField label="Часовой пояс" htmlFor="category-create-timezone" required>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <FormSelect
                  id="category-create-timezone"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  options={TIMEZONE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                />
              )}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Дедлайн (время)" htmlFor="category-create-due-time" required error={errors.defaultDueTimeLocal?.message} hint="Формат ЧЧ:ММ">
              <FormInput id="category-create-due-time" placeholder="23:59" invalid={errors.defaultDueTimeLocal !== undefined} {...register('defaultDueTimeLocal')} />
            </FormField>
            <FormField label="Срок, дней" htmlFor="category-create-due-days" required error={errors.defaultDueDays?.message}>
              <FormInput id="category-create-due-days" type="number" min={1} max={60} invalid={errors.defaultDueDays !== undefined} {...register('defaultDueDays')} />
            </FormField>
          </div>
          <FormCheckbox
            label="Разрешить приём после дедлайна"
            description="Ментор сможет отправить решение после дедлайна — задание перейдёт в статус «Просрочено»"
            {...register('allowLateSubmission')}
          />
        </div>
      </FormSection>
    </form>
  );
}

export interface CategoryEditFormProps {
  formId: string;
  category: PreviewCategoryDetails;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: CategoryEditFormValues) => void | Promise<void>;
}

/** Branch/Lead не меняются здесь — отдельные workflows Assign/Change Lead (раздел 9 промпта). */
export function CategoryEditForm({ formId, category, bannerError, onDirtyChange, onSubmit }: CategoryEditFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<CategoryEditFormValues>({
    resolver: zodResolver(categoryEditSchema),
    mode: 'onTouched',
    defaultValues: {
      name: category.name,
      description: category.description ?? '',
      timezone: category.timezone,
      defaultDueTimeLocal: category.defaultDueTimeLocal,
      defaultDueDays: category.defaultDueDays,
      allowLateSubmission: category.allowLateSubmission,
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const submit = handleSubmit((values) => {
    void onSubmit(values);
  });

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      {bannerError !== null ? <FormBannerError message={bannerError} /> : null}

      <FormSection title="Основная информация">
        <div className="space-y-4">
          <FormField label="Название" htmlFor="category-edit-name" required error={errors.name?.message}>
            <FormInput id="category-edit-name" invalid={errors.name !== undefined} {...fieldA11yProps('category-edit-name', errors.name?.message)} {...register('name')} />
          </FormField>
          <FormField label="Описание" htmlFor="category-edit-description" error={errors.description?.message} hint="Необязательно">
            <FormTextarea id="category-edit-description" invalid={errors.description !== undefined} {...register('description')} />
          </FormField>
          <ReadOnlyField label="Филиал" value={category.branchName} hint="Направление принадлежит филиалу с момента создания" />
        </div>
      </FormSection>

      <FormSection title="Настройки задания">
        <div className="space-y-4">
          <FormField label="Часовой пояс" htmlFor="category-edit-timezone" required>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <FormSelect
                  id="category-edit-timezone"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  options={TIMEZONE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                />
              )}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Дедлайн (время)" htmlFor="category-edit-due-time" required error={errors.defaultDueTimeLocal?.message} hint="Формат ЧЧ:ММ">
              <FormInput id="category-edit-due-time" invalid={errors.defaultDueTimeLocal !== undefined} {...register('defaultDueTimeLocal')} />
            </FormField>
            <FormField label="Срок, дней" htmlFor="category-edit-due-days" required error={errors.defaultDueDays?.message}>
              <FormInput id="category-edit-due-days" type="number" min={1} max={60} invalid={errors.defaultDueDays !== undefined} {...register('defaultDueDays')} />
            </FormField>
          </div>
          <FormCheckbox
            label="Разрешить приём после дедлайна"
            description="Действует немедленно, включая уже созданные задания"
            {...register('allowLateSubmission')}
          />
        </div>
      </FormSection>
    </form>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { CategorySettingsDto } from '../../api/admin/categories';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import { SearchSelect } from '../../shared/select';
import { FormBannerError, FormCheckbox, FormField, FormInput, FormSection, FormSelect, FormTextarea, ReadOnlyField, fieldA11yProps } from '../../shared/ui/FormField';
import { useBranchContext } from '../branch-context/useBranchContext';
import { categoryCreateSchema, categoryEditSchema } from './categoryForm.schema';
import type { CategoryCreateFormValues, CategoryEditFormValues } from './categoryForm.schema';
import { TIMEZONE_OPTIONS } from './categoryPresentation';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface CategoryCreateFormProps {
  formId: string;
  isOrgAdmin: boolean;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: CategoryCreateFormValues, helpers: { setNameError: (message: string) => void }) => void | Promise<void>;
}

/**
 * Секции раздела 9 промпта: Основная информация → Руководитель → Настройки задания.
 * `POST /categories` не принимает `branchId` в теле — выбор в форме реально передаётся как
 * override заголовка `X-MTF-Branch-Id` на один запрос (см. `api/admin/categories.ts#createCategory`).
 */
export function CategoryCreateForm({ formId, isOrgAdmin, bannerError, onDirtyChange, onSubmit }: CategoryCreateFormProps): JSX.Element {
  const branchContext = useBranchContext();
  const { users } = useUsersQuery();
  const ownBranchId = branchContext.fixedBranch?.id ?? '';

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
      branchId: isOrgAdmin ? '' : ownBranchId,
      leadUserId: '',
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const branchId = watch('branchId');
  const leadCandidates = users.filter((user) => user.role === 'Mentor' && user.status === 'Active' && user.branchId === branchId);

  useEffect(() => {
    setValue('leadUserId', '', { shouldValidate: false, shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сбрасываем именно при смене branchId
  }, [branchId]);

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
            <FormField label="Филиал" htmlFor="category-create-branch" required error={errors.branchId?.message}>
              <Controller
                control={control}
                name="branchId"
                render={({ field }) => (
                  <FormSelect
                    id="category-create-branch"
                    invalid={errors.branchId !== undefined}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="Выберите филиал"
                    options={branchContext.availableBranches.map((branch) => ({ value: branch.id, label: branch.name }))}
                  />
                )}
              />
            </FormField>
          ) : (
            <ReadOnlyField label="Филиал" value={branchContext.fixedBranch?.name ?? '—'} hint="Ваш филиал — изменить нельзя" />
          )}
        </div>
      </FormSection>

      <FormSection title="Руководитель" description="Можно назначить сейчас или отдельным действием позже">
        <FormField label="Руководитель направления" htmlFor="category-create-lead" hint={branchId.length === 0 ? 'Сначала выберите филиал' : undefined}>
          <Controller
            control={control}
            name="leadUserId"
            render={({ field }) => (
              <SearchSelect
                id="category-create-lead"
                disabled={branchId.length === 0}
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

      <FormSection title="Настройки задания" description="Дедлайн, часовой пояс и приём после срока настраиваются значениями по умолчанию (часовой пояс филиала, 23:59, 3 дня) и доступны для изменения сразу после создания направления — кнопка «Редактировать» в карточке.">
        <p className="rounded-control-sm border border-line bg-surface-muted px-3 py-2.5 text-[13px] text-ink-muted">
          Направление будет создано со стандартными настройками задания. Изменить их можно в любой момент после создания.
        </p>
      </FormSection>
    </form>
  );
}

export interface CategoryEditFormProps {
  formId: string;
  category: PreviewCategoryDetails;
  /** `undefined`, пока `GET /categories/{id}/settings` ещё не ответил — `CategoryFormDrawer` не рендерит форму до этого момента. */
  settings: CategorySettingsDto;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: CategoryEditFormValues) => void | Promise<void>;
}

/** Branch/Lead не меняются здесь — отдельные workflows Assign/Change Lead (раздел 9 промпта). Настройки задания — из отдельного backend-ресурса (`GET /categories/{id}/settings`), не из `category`. */
export function CategoryEditForm({ formId, category, settings, bannerError, onDirtyChange, onSubmit }: CategoryEditFormProps): JSX.Element {
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
      timezone: settings.timeZoneId,
      defaultDueTimeLocal: settings.defaultDueTimeLocal,
      defaultDueDays: settings.defaultAssignmentDueDays,
      allowLateSubmission: settings.allowLateSubmission,
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

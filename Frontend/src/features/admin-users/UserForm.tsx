import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { FormBannerError, FormCheckbox, FormField, FormInput, FormSection, FormSelect, ReadOnlyField, fieldA11yProps } from '../../shared/ui/FormField';
import { BRANCH_DIRECTORY } from '../admin-preview/branchDirectory';
import { ASSIGNABLE_ROLE_VALUES, userCreateSchema, userEditSchema } from './userForm.schema';
import type { UserCreateFormValues, UserEditFormValues } from './userForm.schema';
import { NOTIFICATION_LANGUAGES, NOTIFICATION_LANGUAGE_LABEL, activeCategoriesForBranch } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';

const ROLE_SELECT_OPTIONS = ASSIGNABLE_ROLE_VALUES.map((value) => ({ value, label: ROLE_LABEL[value] }));

export interface UserCreateFormProps {
  formId: string;
  isOrgAdmin: boolean;
  /** Raw branch name (`branchName`) фиксированного филиала Branch Admin. */
  currentBranchRawName: string | null;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: UserCreateFormValues, helpers: { setEmailError: (message: string) => void }) => void | Promise<void>;
}

/** Секции 1–3 из раздела 12/13 промпта: Основная информация → Роль и доступ → Приглашение. */
export function UserCreateForm({ formId, isOrgAdmin, currentBranchRawName, bannerError, onDirtyChange, onSubmit }: UserCreateFormProps): JSX.Element {
  const defaultRole = isOrgAdmin ? 'Mentor' : 'Mentor';
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      role: defaultRole,
      branchName: isOrgAdmin ? '' : (currentBranchRawName ?? ''),
      categoryName: '',
      notificationLanguage: 'ru',
      sendInvitationNow: true,
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const role = watch('role');
  const branchName = watch('branchName');
  const needsCategory = role === 'Lead' || role === 'Mentor';
  const categoryOptions = branchName.length > 0 ? activeCategoriesForBranch(branchName) : [];

  // Раздел 13 промпта: смена Branch сбрасывает несовместимую Category, не оставляя скрытое значение.
  useEffect(() => {
    setValue('categoryName', '', { shouldValidate: false, shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сбрасываем именно при смене branchName, не на каждый ре-рендер
  }, [branchName]);

  const submit = handleSubmit((values) => {
    void onSubmit(values, {
      setEmailError: (message) => {
        setError('email', { type: 'server', message });
      },
    });
  });

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      {bannerError !== null ? <FormBannerError message={bannerError} /> : null}

      <FormSection title="Основная информация">
        <div className="space-y-4">
          <FormField label="Имя и фамилия" htmlFor="user-create-fullName" required error={errors.fullName?.message}>
            <FormInput id="user-create-fullName" placeholder="Имя Фамилия" invalid={errors.fullName !== undefined} {...fieldA11yProps('user-create-fullName', errors.fullName?.message)} {...register('fullName')} />
          </FormField>
          <FormField label="Email" htmlFor="user-create-email" required error={errors.email?.message}>
            <FormInput
              id="user-create-email"
              type="email"
              placeholder="name@softclub-academy.test"
              invalid={errors.email !== undefined}
              {...fieldA11yProps('user-create-email', errors.email?.message)}
              {...register('email')}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Роль и доступ">
        <div className="space-y-4">
          <FormField label="Роль" htmlFor="user-create-role" required error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <FormSelect
                  id="user-create-role"
                  invalid={errors.role !== undefined}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  options={ROLE_SELECT_OPTIONS.filter((option) => isOrgAdmin || option.value !== 'BranchAdmin')}
                />
              )}
            />
          </FormField>

          {isOrgAdmin ? (
            <FormField label="Филиал" htmlFor="user-create-branch" required error={errors.branchName?.message}>
              <Controller
                control={control}
                name="branchName"
                render={({ field }) => (
                  <FormSelect
                    id="user-create-branch"
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

          {needsCategory ? (
            <FormField label="Направление" htmlFor="user-create-category" required error={errors.categoryName?.message} hint={branchName.length === 0 ? 'Сначала выберите филиал' : undefined}>
              <Controller
                control={control}
                name="categoryName"
                render={({ field }) => (
                  <FormSelect
                    id="user-create-category"
                    disabled={branchName.length === 0}
                    invalid={errors.categoryName !== undefined}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="Выберите направление"
                    options={categoryOptions.map((category) => ({ value: category.name, label: category.name }))}
                  />
                )}
              />
            </FormField>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Приглашение">
        <div className="space-y-4">
          <FormField label="Язык уведомлений" htmlFor="user-create-language">
            <Controller
              control={control}
              name="notificationLanguage"
              render={({ field }) => (
                <FormSelect
                  id="user-create-language"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  options={NOTIFICATION_LANGUAGES.map((lang) => ({ value: lang, label: NOTIFICATION_LANGUAGE_LABEL[lang] }))}
                />
              )}
            />
          </FormField>
          <FormCheckbox label="Отправить приглашение сразу" {...register('sendInvitationNow')} />
        </div>
      </FormSection>
    </form>
  );
}

export interface UserEditFormProps {
  formId: string;
  user: PreviewUserDetails;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: UserEditFormValues) => void | Promise<void>;
}

/** Edit mode: только имя и язык уведомлений — Role/Branch/Category идут через отдельные workflows (раздел 16 промпта). */
export function UserEditForm({ formId, user, bannerError, onDirtyChange, onSubmit }: UserEditFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    mode: 'onTouched',
    defaultValues: { fullName: user.fullName, notificationLanguage: user.notificationLanguage },
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
          <FormField label="Имя и фамилия" htmlFor="user-edit-fullName" required error={errors.fullName?.message}>
            <FormInput id="user-edit-fullName" invalid={errors.fullName !== undefined} {...fieldA11yProps('user-edit-fullName', errors.fullName?.message)} {...register('fullName')} />
          </FormField>
          <ReadOnlyField label="Email" value={user.email} hint="Email используется для входа и изменяется отдельной процедурой" />
        </div>
      </FormSection>

      <FormSection title="Уведомления">
        <FormField label="Язык уведомлений" htmlFor="user-edit-language">
          <Controller
            control={control}
            name="notificationLanguage"
            render={({ field }) => (
              <FormSelect
                id="user-edit-language"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                options={NOTIFICATION_LANGUAGES.map((lang) => ({ value: lang, label: NOTIFICATION_LANGUAGE_LABEL[lang] }))}
              />
            )}
          />
        </FormField>
      </FormSection>
    </form>
  );
}

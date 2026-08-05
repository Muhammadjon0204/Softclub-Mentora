import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useUsersPreview } from '../admin-users/userPreviewStore';
import { FormBannerError, FormField, FormInput, FormSection, FormSelect, ReadOnlyField, fieldA11yProps } from '../../shared/ui/FormField';
import { ADMIN_OPTION_VALUES, branchCreateSchema, branchEditSchema } from './branchForm.schema';
import type { AdminOptionValue, BranchCreateFormValues, BranchEditFormValues } from './branchForm.schema';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from './branchPresentation';
import type { PreviewBranchDetails } from './branchPresentation';

export interface BranchCreateFormProps {
  formId: string;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: BranchCreateFormValues, helpers: { setNameError: (message: string) => void; setCodeError: (message: string) => void }) => void | Promise<void>;
}

/** Секции 1–4 из раздела 28 промпта: Основная информация → Контакты → Региональные настройки → Администратор. */
export function BranchCreateForm({ formId, bannerError, onDirtyChange, onSubmit }: BranchCreateFormProps): JSX.Element {
  const users = useUsersPreview();
  const adminCandidates = users.filter((user) => user.status !== 'Deactivated' && user.role !== 'OrgAdmin');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isDirty },
  } = useForm<BranchCreateFormValues>({
    resolver: zodResolver(branchCreateSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      code: '',
      city: '',
      address: '',
      email: '',
      phone: '',
      timezone: DEFAULT_TIMEZONE,
      adminOption: 'none',
      adminUserId: '',
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const adminOption = watch('adminOption');

  const submit = handleSubmit((values) => {
    void onSubmit(values, {
      setNameError: (message) => { setError('name', { type: 'server', message }); },
      setCodeError: (message) => { setError('code', { type: 'server', message }); },
    });
  });

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      {bannerError !== null ? <FormBannerError message={bannerError} /> : null}

      <FormSection title="Основная информация">
        <div className="space-y-4">
          <FormField label="Название" htmlFor="branch-create-name" required error={errors.name?.message}>
            <FormInput id="branch-create-name" placeholder="Например, Согд" invalid={errors.name !== undefined} {...fieldA11yProps('branch-create-name', errors.name?.message)} {...register('name')} />
          </FormField>
          <FormField label="Код" htmlFor="branch-create-code" required error={errors.code?.message} hint="Латинские буквы, цифры и дефис">
            <FormInput id="branch-create-code" placeholder="SOG-01" invalid={errors.code !== undefined} {...fieldA11yProps('branch-create-code', errors.code?.message, 'Латинские буквы, цифры и дефис')} {...register('code')} />
          </FormField>
          <FormField label="Город" htmlFor="branch-create-city" required error={errors.city?.message}>
            <FormInput id="branch-create-city" placeholder="Худжанд" invalid={errors.city !== undefined} {...fieldA11yProps('branch-create-city', errors.city?.message)} {...register('city')} />
          </FormField>
          <FormField label="Адрес" htmlFor="branch-create-address" required error={errors.address?.message}>
            <FormInput id="branch-create-address" placeholder="г. Худжанд, ул. Ленина, 5" invalid={errors.address !== undefined} {...fieldA11yProps('branch-create-address', errors.address?.message)} {...register('address')} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Контакты">
        <div className="space-y-4">
          <FormField label="Email" htmlFor="branch-create-email" error={errors.email?.message}>
            <FormInput id="branch-create-email" type="email" placeholder="branch@softclub-academy.test" invalid={errors.email !== undefined} {...fieldA11yProps('branch-create-email', errors.email?.message)} {...register('email')} />
          </FormField>
          <FormField label="Телефон" htmlFor="branch-create-phone" error={errors.phone?.message}>
            <FormInput id="branch-create-phone" placeholder="+992 37 000-00-00" invalid={errors.phone !== undefined} {...fieldA11yProps('branch-create-phone', errors.phone?.message)} {...register('phone')} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Региональные настройки">
        <FormField label="Часовой пояс" htmlFor="branch-create-timezone" required>
          <FormSelect id="branch-create-timezone" {...register('timezone')}>
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FormSelect>
        </FormField>
      </FormSection>

      <FormSection title="Администратор" description="Можно назначить сейчас или отдельным действием позже">
        <div className="space-y-4">
          <FormField label="Администратор филиала" htmlFor="branch-create-admin-option">
            <FormSelect id="branch-create-admin-option" {...register('adminOption')}>
              {ADMIN_OPTION_VALUES.map((value) => (
                <option key={value} value={value}>{value === 'none' ? 'Не назначать сейчас' : 'Выбрать существующего пользователя'}</option>
              ))}
            </FormSelect>
          </FormField>

          {(adminOption as AdminOptionValue) === 'existing' ? (
            <FormField label="Пользователь" htmlFor="branch-create-admin-user" required error={errors.adminUserId?.message}>
              <FormSelect id="branch-create-admin-user" invalid={errors.adminUserId !== undefined} {...register('adminUserId')}>
                <option value="">Выберите пользователя</option>
                {adminCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.email}</option>
                ))}
              </FormSelect>
            </FormField>
          ) : null}
        </div>
      </FormSection>
    </form>
  );
}

export interface BranchEditFormProps {
  formId: string;
  branch: PreviewBranchDetails;
  bannerError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: BranchEditFormValues) => void | Promise<void>;
}

/** Code read-only после создания (раздел 31 промпта). */
export function BranchEditForm({ formId, branch, bannerError, onDirtyChange, onSubmit }: BranchEditFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<BranchEditFormValues>({
    resolver: zodResolver(branchEditSchema),
    mode: 'onTouched',
    defaultValues: {
      name: branch.name,
      city: branch.city,
      address: branch.address,
      email: branch.email ?? '',
      phone: branch.phone ?? '',
      timezone: branch.timezone,
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
          <FormField label="Название" htmlFor="branch-edit-name" required error={errors.name?.message}>
            <FormInput id="branch-edit-name" invalid={errors.name !== undefined} {...fieldA11yProps('branch-edit-name', errors.name?.message)} {...register('name')} />
          </FormField>
          <ReadOnlyField label="Код" value={branch.code} hint="Код используется в системных идентификаторах и не изменяется" />
          <FormField label="Город" htmlFor="branch-edit-city" required error={errors.city?.message}>
            <FormInput id="branch-edit-city" invalid={errors.city !== undefined} {...fieldA11yProps('branch-edit-city', errors.city?.message)} {...register('city')} />
          </FormField>
          <FormField label="Адрес" htmlFor="branch-edit-address" required error={errors.address?.message}>
            <FormInput id="branch-edit-address" invalid={errors.address !== undefined} {...fieldA11yProps('branch-edit-address', errors.address?.message)} {...register('address')} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Контакты">
        <div className="space-y-4">
          <FormField label="Email" htmlFor="branch-edit-email" error={errors.email?.message}>
            <FormInput id="branch-edit-email" type="email" invalid={errors.email !== undefined} {...fieldA11yProps('branch-edit-email', errors.email?.message)} {...register('email')} />
          </FormField>
          <FormField label="Телефон" htmlFor="branch-edit-phone" error={errors.phone?.message}>
            <FormInput id="branch-edit-phone" invalid={errors.phone !== undefined} {...fieldA11yProps('branch-edit-phone', errors.phone?.message)} {...register('phone')} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Региональные настройки">
        <FormField label="Часовой пояс" htmlFor="branch-edit-timezone" required>
          <FormSelect id="branch-edit-timezone" {...register('timezone')}>
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FormSelect>
        </FormField>
      </FormSection>
    </form>
  );
}

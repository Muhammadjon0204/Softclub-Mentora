import { z } from 'zod';

import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from './branchPresentation';

const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map((option) => option.value) as [string, ...string[]];

const nameField = z.string().trim().min(2, 'Введите название').max(120, 'Не более 120 символов');
const cityField = z.string().trim().min(2, 'Введите город').max(100, 'Не более 100 символов');
const addressField = z.string().trim().min(5, 'Введите адрес').max(250, 'Не более 250 символов');
const emailField = z.union([z.literal(''), z.string().trim().email('Введите корректный email')]);
const phoneField = z.string().trim().max(40, 'Слишком длинный номер');
const timezoneField = z.enum(TIMEZONE_VALUES);

export const ADMIN_OPTION_VALUES = ['none', 'existing'] as const;
export type AdminOptionValue = (typeof ADMIN_OPTION_VALUES)[number];

export const branchCreateSchema = z
  .object({
    name: nameField,
    code: z
      .string()
      .trim()
      .min(2, 'Введите код')
      .max(20, 'Не более 20 символов')
      .regex(/^[A-Za-z0-9-]+$/, 'Только латинские буквы, цифры и дефис')
      .transform((value) => value.toUpperCase()),
    city: cityField,
    address: addressField,
    email: emailField,
    phone: phoneField,
    timezone: timezoneField,
    adminOption: z.enum(ADMIN_OPTION_VALUES),
    adminUserId: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.adminOption === 'existing' && (values.adminUserId === undefined || values.adminUserId.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adminUserId'], message: 'Выберите пользователя' });
    }
  });

export type BranchCreateFormValues = z.infer<typeof branchCreateSchema>;

/** Code read-only после создания (раздел 31 промпта) — в edit-схеме его нет. */
export const branchEditSchema = z.object({
  name: nameField,
  city: cityField,
  address: addressField,
  email: emailField,
  phone: phoneField,
  timezone: timezoneField,
});

export type BranchEditFormValues = z.infer<typeof branchEditSchema>;

export const DEFAULT_TIMEZONE_VALUE = DEFAULT_TIMEZONE;

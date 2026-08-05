import { z } from 'zod';

import { NOTIFICATION_LANGUAGES } from './userPresentation';

const fullNameField = z
  .string()
  .trim()
  .min(2, 'Введите имя и фамилию')
  .max(120, 'Не более 120 символов');

const emailField = z.string().trim().min(1, 'Введите email').email('Введите корректный email');

export const ASSIGNABLE_ROLE_VALUES = ['BranchAdmin', 'Lead', 'Mentor'] as const;
export type AssignableRoleValue = (typeof ASSIGNABLE_ROLE_VALUES)[number];

/** Роль определяет обязательность Branch/Category (раздел 13 промпта) — проверяется в `superRefine`. */
export const userCreateSchema = z
  .object({
    fullName: fullNameField,
    email: emailField,
    role: z.enum(ASSIGNABLE_ROLE_VALUES, { errorMap: () => ({ message: 'Выберите роль' }) }),
    branchName: z.string().min(1, 'Выберите филиал'),
    categoryName: z.string().optional(),
    notificationLanguage: z.enum(NOTIFICATION_LANGUAGES),
    sendInvitationNow: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const needsCategory = values.role === 'Lead' || values.role === 'Mentor';
    if (needsCategory && (values.categoryName === undefined || values.categoryName.trim().length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryName'], message: 'Выберите направление' });
    }
  });

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;

/** Edit mode меняет только имя и язык уведомлений — Role/Branch/Category идут через отдельные workflows (раздел 16 промпта). */
export const userEditSchema = z.object({
  fullName: fullNameField,
  notificationLanguage: z.enum(NOTIFICATION_LANGUAGES),
});

export type UserEditFormValues = z.infer<typeof userEditSchema>;

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

/** Роль определяет обязательность Category (раздел 13 промпта) — проверяется в `superRefine`. Branch не влияет на обязательность категории напрямую, но выбор категории зависит от выбранного филиала. */
export const userCreateSchema = z
  .object({
    fullName: fullNameField,
    email: emailField,
    role: z.enum(ASSIGNABLE_ROLE_VALUES, { errorMap: () => ({ message: 'Выберите роль' }) }),
    branchId: z.string().min(1, 'Выберите филиал'),
    categoryId: z.string().optional(),
    notificationLanguage: z.enum(NOTIFICATION_LANGUAGES),
    sendInvitationNow: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const needsCategory = values.role === 'Lead' || values.role === 'Mentor';
    if (needsCategory && (values.categoryId === undefined || values.categoryId.trim().length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryId'], message: 'Выберите направление' });
    }
  });

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;

/** Edit mode меняет только имя и язык уведомлений — Role/Branch/Category идут через отдельные workflows (раздел 16 промпта). */
export const userEditSchema = z.object({
  fullName: fullNameField,
  notificationLanguage: z.enum(NOTIFICATION_LANGUAGES),
});

export type UserEditFormValues = z.infer<typeof userEditSchema>;

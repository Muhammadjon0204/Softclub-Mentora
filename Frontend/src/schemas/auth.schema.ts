import { z } from 'zod';

const emailField = z.string().min(1, 'Введите email').email('Введите корректный email');

export const loginSchema = z.object({
  email: emailField,
  // Никаких клиентских ограничений длины: политику для существующих паролей знает сервер.
  password: z.string().min(1, 'Введите пароль'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Требования, которые проверяются на клиенте.
 *
 * Проверка по списку top-10000 паролей здесь СОЗНАТЕЛЬНО отсутствует —
 * она серверная и приходит как `400 VALIDATION_FAILED`.
 */
export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'От 12 до 128 символов',
    test: (value: string): boolean => value.length >= 12 && value.length <= 128,
  },
  {
    id: 'uppercase',
    label: 'Хотя бы одна заглавная буква',
    test: (value: string): boolean => /[A-Z]/.test(value),
  },
  {
    id: 'digit',
    label: 'Хотя бы одна цифра',
    test: (value: string): boolean => /\d/.test(value),
  },
] as const;

export const newPasswordSchema = z
  .string()
  .min(1, 'Введите пароль')
  .min(12, 'Пароль должен содержать минимум 12 символов')
  .max(128, 'Пароль должен содержать не более 128 символов')
  .regex(/[A-Z]/, 'Пароль должен содержать заглавную букву')
  .regex(/\d/, 'Пароль должен содержать цифру');

export const passwordSetupSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Повторите пароль'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Пароли не совпадают',
  });

export type PasswordSetupFormValues = z.infer<typeof passwordSetupSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Повторите пароль'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Пароли не совпадают',
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

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

/** Совпадает с серверной `PasswordPolicy`: 5–8 любых символов, без требований к составу. */
export const PASSWORD_MIN_LENGTH = 5;
export const PASSWORD_MAX_LENGTH = 8;

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `От ${String(PASSWORD_MIN_LENGTH)} до ${String(PASSWORD_MAX_LENGTH)} символов — любые буквы и цифры`,
    test: (value: string): boolean => value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
  },
] as const;

export const newPasswordSchema = z
  .string()
  .min(1, 'Введите пароль')
  .min(PASSWORD_MIN_LENGTH, `Пароль должен содержать минимум ${String(PASSWORD_MIN_LENGTH)} символов`)
  .max(PASSWORD_MAX_LENGTH, `Пароль должен содержать не более ${String(PASSWORD_MAX_LENGTH)} символов`);

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

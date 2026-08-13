import { z } from 'zod';

/**
 * REV-002: `comment` обязателен только при `NeedsRework` (10–3000 симв.),
 * `reworkDueAt` обязателен только при `NeedsRework` и обязан быть строго
 * позже текущего момента (проверяется в компоненте, где известен `MOCK_NOW`
 * категории — здесь только форма полей длины строки).
 */
export const approveSchema = z.object({
  comment: z.string().trim().max(3000, 'Не более 3000 символов').optional().or(z.literal('')),
});
export type ApproveFormValues = z.infer<typeof approveSchema>;

export const needsReworkSchema = z.object({
  comment: z.string().trim().min(10, 'Не менее 10 символов').max(3000, 'Не более 3000 символов'),
  reworkDueDate: z.string().min(1, 'Укажите дату'),
  reworkDueTime: z.string().min(1, 'Укажите время'),
});
export type NeedsReworkFormValues = z.infer<typeof needsReworkSchema>;

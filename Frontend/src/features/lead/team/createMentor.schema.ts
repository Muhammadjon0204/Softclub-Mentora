import { z } from 'zod';

/**
 * USER-002/USER-032: Lead создаёт только Mentor своей категории. Форма
 * намеренно не содержит `role`/`organizationId`/`branchId`/`categoryId` —
 * ТЗ прямо запрещает принимать их в теле запроса Lead (400 `VALIDATION_FAILED`
 * при наличии); все четыре поля определяются сервером из scope Lead.
 */
export const createMentorSchema = z.object({
  fullName: z.string().trim().min(2, 'Введите имя и фамилию').max(120, 'Не более 120 символов'),
  email: z.string().trim().min(1, 'Введите email').email('Введите корректный email'),
});

export type CreateMentorFormValues = z.infer<typeof createMentorSchema>;

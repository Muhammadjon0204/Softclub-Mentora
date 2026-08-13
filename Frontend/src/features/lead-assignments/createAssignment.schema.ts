import { z } from 'zod';

/**
 * Валидация формы создания Draft Assignment — только подтверждённые ТЗ
 * ограничения, ничего не придумано:
 * - `Title` 3–200 симв., `Description` ≤2000 симв. (ТЗ 10.6, `Assignment`);
 * - Mentor обязателен, только активный ментор своей категории (10.6, composite FK);
 * - дедлайн обязателен и не может быть в прошлом (`ASN-027`).
 * Branch/Category не входят в форму — они фиксированы scope Lead и никогда
 * не выбираются (раздел 21 задачи Phase 3).
 */
export const createAssignmentSchema = z.object({
  topicAssignmentId: z.string(),
  title: z.string().trim().min(3, 'Не менее 3 символов').max(200, 'Не более 200 символов'),
  description: z.string().trim().max(2000, 'Не более 2000 символов').optional().or(z.literal('')),
  mentorId: z.string().min(1, 'Выберите ментора'),
  dueDate: z.string().min(1, 'Укажите дату дедлайна'),
  dueTime: z.string().min(1, 'Укажите время'),
});

export type CreateAssignmentFormValues = z.infer<typeof createAssignmentSchema>;

export const DEFAULT_DUE_TIME_LOCAL = '23:59';

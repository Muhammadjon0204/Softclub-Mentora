import { z } from 'zod';

import { TIMEZONE_OPTIONS } from './categoryPresentation';

const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map((option) => option.value) as [string, ...string[]];

/** Backend допускает минимум 2 символа в названии (см. docs §4.6), схема здесь чуть строже — 2 тоже проходит. */
const baseFields = {
  name: z.string().trim().min(2, 'Введите название').max(120, 'Не более 120 символов'),
  description: z.string().trim().max(1000, 'Не более 1000 символов').optional(),
};

/**
 * `POST /categories` не принимает настройки задания — сервер всегда создаёт их значениями по
 * умолчанию (`CategorySettings.CreateDefault`, наследует часовой пояс филиала), см.
 * `Backend/src/MentorTaskFlow.Domain/Categories/CategorySettings.cs`. Поэтому в форме создания этих
 * полей нет вовсе — раньше они были здесь, реально валидировались, но `CategoryFormDrawer` молча
 * отбрасывал введённые значения при отправке: администратор заполнял «обязательное» поле, которое
 * ни на что не влияло. Настроить дедлайн/часовой пояс можно сразу после создания через «Редактировать».
 */
export const categoryCreateSchema = z.object({
  ...baseFields,
  branchId: z.string().min(1, 'Выберите филиал'),
  leadUserId: z.string().optional(),
});

export type CategoryCreateFormValues = z.infer<typeof categoryCreateSchema>;

/** `1–60; default 3` — CAT-модель CategorySettings.DefaultAssignmentDueDays (раздел 10.3 ТЗ). */
export const categoryEditSchema = z.object({
  ...baseFields,
  timezone: z.enum(TIMEZONE_VALUES),
  defaultDueTimeLocal: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Формат ЧЧ:ММ'),
  defaultDueDays: z.coerce.number().int('Целое число').min(1, 'Минимум 1 день').max(60, 'Максимум 60 дней'),
  allowLateSubmission: z.boolean(),
});

export type CategoryEditFormValues = z.infer<typeof categoryEditSchema>;

import { z } from 'zod';

import { DEFAULT_DUE_DAYS, DEFAULT_DUE_TIME, DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from './categoryPresentation';

const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map((option) => option.value) as [string, ...string[]];

/** `1–60; default 3` — CAT-модель CategorySettings.DefaultAssignmentDueDays (раздел 10.3 ТЗ). Backend
 * допускает минимум 2 символа в названии (см. docs §4.6), схема здесь чуть строже — 2 тоже проходит. */
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, 'Введите название').max(120, 'Не более 120 символов'),
  description: z.string().trim().max(1000, 'Не более 1000 символов').optional(),
  branchId: z.string().min(1, 'Выберите филиал'),
  leadUserId: z.string().optional(),
  timezone: z.enum(TIMEZONE_VALUES),
  defaultDueTimeLocal: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Формат ЧЧ:ММ'),
  defaultDueDays: z.coerce.number().int('Целое число').min(1, 'Минимум 1 день').max(60, 'Максимум 60 дней'),
  allowLateSubmission: z.boolean(),
});

export type CategoryCreateFormValues = z.infer<typeof categoryCreateSchema>;

export const categoryEditSchema = categoryCreateSchema.omit({ branchId: true, leadUserId: true });

export type CategoryEditFormValues = z.infer<typeof categoryEditSchema>;

export const CATEGORY_CREATE_DEFAULTS = {
  timezone: DEFAULT_TIMEZONE,
  defaultDueTimeLocal: DEFAULT_DUE_TIME,
  defaultDueDays: DEFAULT_DUE_DAYS,
  allowLateSubmission: true,
} as const;

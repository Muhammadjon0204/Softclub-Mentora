import { z } from 'zod';

/** TOPIC-010/10.4: `DayNumber` > 0, `Title` 3–200, `Description` ≤2000. `PlannedDate` необязательна (используется автогенерацией, если задана). */
export const topicSchema = z.object({
  dayNumber: z.coerce.number().int('Целое число').min(1, 'Больше 0'),
  plannedDate: z.string(),
  title: z.string().trim().min(3, 'Не менее 3 символов').max(200, 'Не более 200 символов'),
  description: z.string().trim().max(2000, 'Не более 2000 символов').optional().or(z.literal('')),
});
export type TopicFormValues = z.infer<typeof topicSchema>;

/** TPL-001/10.5: `Title` 3–200, `Description` ≤2000, `Type` — один из трёх. */
export const topicAssignmentSchema = z.object({
  type: z.enum(['Presentation', 'ClassTask', 'HomeTask']),
  title: z.string().trim().min(3, 'Не менее 3 символов').max(200, 'Не более 200 символов'),
  description: z.string().trim().max(2000, 'Не более 2000 символов').optional().or(z.literal('')),
  isRequired: z.boolean(),
});
export type TopicAssignmentFormValues = z.infer<typeof topicAssignmentSchema>;

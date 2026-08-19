/**
 * Mentor не владеет отдельным Assignment-стором — он читает и мутирует тот
 * же самый `leadAssignmentPreviewStore` (см. `useScopedMentorAssignments`,
 * которая фильтрует общий массив по `mentorId`). Этот файл — тонкая
 * role-facing витрина: держит Mentor-код в границах `features/mentor/*` и
 * даёт понятные имена единственной Mentor-легальной мутации (`submitPreview`
 * → «Mentor отправляет решение»), не размножая доменную логику по двум
 * местам (раздел 29 промпта — «не дублируй бизнес-логику»).
 */
export { LeadAssignmentPreviewError as MentorAssignmentPreviewError, submitPreview } from '../../lead/assignments/leadAssignmentPreviewStore';
export type { SubmitInput } from '../../lead/assignments/leadAssignmentPreviewStore';

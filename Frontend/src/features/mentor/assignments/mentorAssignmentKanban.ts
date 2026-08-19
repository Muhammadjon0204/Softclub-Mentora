import { getAssignmentKanbanLane } from '../../lead/assignments/leadAssignmentKanban';
import type { KanbanLaneId } from '../../lead/assignments/leadAssignmentKanban';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';

export type { KanbanLaneId };
export { getAssignmentKanbanLane };

export interface MentorKanbanLaneDef {
  id: KanbanLaneId;
  title: string;
  dot: string;
}

/**
 * Presentation-only перегруппировка — то же lane-разбиение, что у Lead
 * (`getAssignmentKanbanLane`, реэкспортирован без изменений: один и тот же
 * Assignment обязан попадать в эквивалентную колонку у обеих ролей). Из
 * состава Kanban Mentor исключена только колонка «Подготовка»
 * (`Draft`/`Suggested`) — эти статусы Mentor не видит вовсе (ТЗ 13.2), и
 * `useScopedMentorAssignments` уже отфильтровывает такие записи, так что
 * колонка была бы вечно пустой.
 */
export const MENTOR_KANBAN_LANES: MentorKanbanLaneDef[] = [
  { id: 'assigned', title: 'Назначено', dot: 'bg-info' },
  { id: 'review', title: 'На проверке', dot: 'bg-brand' },
  { id: 'rework', title: 'На доработке', dot: 'bg-warning' },
  { id: 'overdue', title: 'Просрочено', dot: 'bg-danger' },
  { id: 'done', title: 'Завершено', dot: 'bg-success' },
];

export function mentorKanbanLaneOf(assignment: LeadAssignmentRecord): KanbanLaneId {
  return getAssignmentKanbanLane(assignment);
}

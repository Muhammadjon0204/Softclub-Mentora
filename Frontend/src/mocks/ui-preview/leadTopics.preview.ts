/**
 * Shared Topic/TopicAssignment record shapes for `/lead/schedule`. The fixture data this file
 * used to hold (`LEAD_TOPICS`, `LEAD_TOPIC_ASSIGNMENTS`) has been deleted along with its only
 * consumer, `leadScopedData.ts` — every real page now reads topics from `GET /topics`
 * (`features/lead/scope/useScopedLeadSchedule.ts`) via `topicAdapter.ts`. Only the label map
 * (still consumed app-wide) and the type definitions survive.
 */

export type TopicAssignmentType = 'Presentation' | 'ClassTask' | 'HomeTask';

export interface LeadTopicAssignmentRecord {
  id: string;
  topicId: string;
  type: TopicAssignmentType;
  title: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  /** Real `TopicAssignmentDto.concurrencyToken` — required by `update`/`activate`/`deactivate`. Optional for callers that build a partial record. */
  concurrencyToken?: string;
}

export interface LeadTopicRecord {
  id: string;
  categoryId: string;
  dayNumber: number;
  /** Real `TopicDto.plannedDate` is `DateOnly?` — genuinely optional; every UI call site must handle `null`. */
  plannedDate: number | null;
  title: string;
  description: string;
  isActive: boolean;
  /** Real `TopicDto.concurrencyToken` — required by `update`/`activate`/`deactivate`. Optional for callers that build a partial record. */
  concurrencyToken?: string;
}

export const TOPIC_ASSIGNMENT_TYPE_LABEL: Record<TopicAssignmentType, string> = {
  Presentation: 'Презентация',
  ClassTask: 'Аудиторное задание',
  HomeTask: 'Домашнее задание',
};

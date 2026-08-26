import type { TopicAssignmentDto, TopicDto } from '../../../api/lead/topics';
import type { LeadTopicAssignmentRecord, LeadTopicRecord, TopicAssignmentType } from '../../../mocks/ui-preview/leadTopics.preview';

/** `DateOnly` on the wire is `"YYYY-MM-DD"` — parsed as UTC midnight so `formatCategoryDate()`'s `Intl.DateTimeFormat` with the category's `timeZoneId` renders the same calendar day regardless of the viewer's local offset. */
function dateOnlyToMs(value: string | null): number | null {
  if (value === null) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** Inverse of `dateOnlyToMs` — epoch ms -> `"YYYY-MM-DD"` for `CreateTopicRequest`/`UpdateTopicRequest`. */
export function msToDateOnly(ms: number | null): string | null {
  if (ms === null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export function toTopicRecord(dto: TopicDto): LeadTopicRecord {
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    dayNumber: dto.dayNumber,
    plannedDate: dateOnlyToMs(dto.plannedDate),
    title: dto.title,
    description: dto.description ?? '',
    isActive: dto.isActive,
    concurrencyToken: dto.concurrencyToken,
  };
}

export function toTopicAssignmentRecord(dto: TopicAssignmentDto): LeadTopicAssignmentRecord {
  return {
    id: dto.id,
    topicId: dto.topicId,
    type: dto.type as TopicAssignmentType,
    title: dto.title,
    description: dto.description ?? '',
    isRequired: dto.isRequired,
    isActive: dto.isActive,
    concurrencyToken: dto.concurrencyToken,
  };
}

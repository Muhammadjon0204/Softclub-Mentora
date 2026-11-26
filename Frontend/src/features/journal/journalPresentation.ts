import type { JournalPerson } from '../../api/journal';

/** Группы фильтра: что обычно ищут в журнале — кто выдал, кто что поменял, что сдано, что просрочено. */
export const JOURNAL_FILTERS = [
  { key: 'all', label: 'Все', eventTypes: undefined },
  { key: 'issue', label: 'Выдача', eventTypes: 'DraftCreated,SuggestedCreated,SuggestionAccepted,Assigned' },
  { key: 'changes', label: 'Изменения', eventTypes: 'DetailsEdited,DeadlineChanged,Reassigned,Cancelled' },
  { key: 'work', label: 'Сдачи и проверки', eventTypes: 'SubmissionUploaded,LateSubmissionUploaded,ReviewStarted,ReviewApproved,ReviewNeedsRework' },
  { key: 'overdue', label: 'Просрочки', eventTypes: 'MarkedOverdue' },
] as const;

export type JournalFilterKey = (typeof JOURNAL_FILTERS)[number]['key'];

export type JournalTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

/** Заголовок записи — те же слова, что в истории задания. */
export const JOURNAL_EVENT_LABEL: Record<string, string> = {
  DraftCreated: 'Черновик создан',
  SuggestedCreated: 'Предложено планировщиком',
  SuggestionAccepted: 'Предложение принято',
  Assigned: 'Задание выдано',
  Reassigned: 'Переназначено',
  SubmissionUploaded: 'Работа сдана на проверку',
  LateSubmissionUploaded: 'Работа сдана с опозданием',
  ReviewStarted: 'Взято на проверку',
  ReviewApproved: 'Работа принята',
  ReviewNeedsRework: 'Возвращено на доработку',
  MarkedOverdue: 'Срок истёк — задание просрочено',
  Cancelled: 'Задание отменено',
  DeadlineChanged: 'Срок изменён',
  DetailsEdited: 'Текст задания исправлен',
};

export const JOURNAL_EVENT_TONE: Record<string, JournalTone> = {
  Assigned: 'brand',
  SuggestionAccepted: 'brand',
  SubmissionUploaded: 'brand',
  ReviewStarted: 'brand',
  ReviewApproved: 'success',
  LateSubmissionUploaded: 'warning',
  ReviewNeedsRework: 'warning',
  DeadlineChanged: 'warning',
  DetailsEdited: 'warning',
  Reassigned: 'warning',
  MarkedOverdue: 'danger',
  Cancelled: 'danger',
};

export const CHANGE_LABEL: Record<string, string> = {
  title: 'Название',
  description: 'Описание',
  dueAt: 'Срок',
  assignee: 'Исполнитель',
};

export function personRoleLabel(person: JournalPerson): string {
  if (person.role === 'Admin') return person.adminScope === 'Branch' ? 'Администратор филиала' : 'Администратор организации';
  if (person.role === 'Lead') return 'Тимлид';
  if (person.role === 'Mentor') return 'Ментор';
  return person.role;
}

/** Ключ дня в локальном времени — для группировки ленты по дням. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

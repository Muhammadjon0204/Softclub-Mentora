import { apiFetch } from '@/lib/api';

/** `Backend/src/MentorTaskFlow.Contracts/Journal/JournalDtos.cs`; the server omits null fields. */
export interface JournalPerson {
  id: string;
  fullName: string;
  role: string;
  adminScope?: string | null;
}

export interface JournalChange {
  field: string;
  before?: string | null;
  after?: string | null;
}

export interface JournalEntry {
  id: string;
  occurredAt: string;
  eventType: string;
  assignmentId: string;
  assignmentTitle: string;
  branchName?: string | null;
  actor?: JournalPerson | null;
  assignee?: JournalPerson | null;
  changes?: JournalChange[];
  note?: string | null;
}

export interface JournalPage {
  items: JournalEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export function listJournal(page: number, eventTypes?: string): Promise<JournalPage> {
  const filter = eventTypes ? `&eventTypes=${encodeURIComponent(eventTypes)}` : '';
  return apiFetch<JournalPage>(`/api/v1/journal?page=${page}&pageSize=30${filter}`);
}

/** The same groups as the site's journal. */
export const JOURNAL_FILTERS = [
  { key: 'all', label: 'Все', eventTypes: undefined },
  { key: 'issue', label: 'Выдача', eventTypes: 'DraftCreated,SuggestedCreated,SuggestionAccepted,Assigned' },
  { key: 'changes', label: 'Изменения', eventTypes: 'DetailsEdited,DeadlineChanged,Reassigned,Cancelled' },
  { key: 'work', label: 'Сдачи и проверки', eventTypes: 'SubmissionUploaded,LateSubmissionUploaded,ReviewStarted,ReviewApproved,ReviewNeedsRework' },
  { key: 'overdue', label: 'Просрочки', eventTypes: 'MarkedOverdue' },
] as const;

export const CHANGE_LABEL: Record<string, string> = {
  title: 'Название',
  description: 'Описание',
  dueAt: 'Срок',
  assignee: 'Исполнитель',
};

export function roleLabel(person: { role: string; adminScope?: string | null; teamRole?: string }): string {
  // A participant uses a mentor's screens without being one.
  if (person.teamRole === 'Member') return 'Участник команды';
  if (person.role === 'Admin') return person.adminScope === 'Branch' ? 'Администратор филиала' : 'Администратор организации';
  if (person.role === 'Lead') return 'Тимлид';
  return person.role === 'Mentor' ? 'Ментор' : person.role;
}

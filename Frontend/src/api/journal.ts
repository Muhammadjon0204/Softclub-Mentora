import { apiClient } from './client';

/** `Backend/src/MentorTaskFlow.Contracts/Journal/JournalDtos.cs`. */
export interface JournalPerson {
  id: string;
  fullName: string;
  role: string;
  adminScope?: string | null;
}

/** `field`: `title` | `description` | `dueAt` (ISO) | `assignee` (ФИО). */
export interface JournalChange {
  field: string;
  before?: string | null;
  after?: string | null;
}

export interface JournalEntry {
  id: string;
  occurredAt: string;
  eventType: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  assignmentId: string;
  assignmentTitle: string;
  branchName?: string | null;
  actor?: JournalPerson | null;
  assignee?: JournalPerson | null;
  changes?: JournalChange[];
  note?: string | null;
  version?: number | null;
}

export interface JournalPage {
  items: JournalEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listJournal(params: { page: number; pageSize: number; eventTypes?: string }): Promise<JournalPage> {
  const { data } = await apiClient.get<JournalPage>('/api/v1/journal', { params });
  return data;
}

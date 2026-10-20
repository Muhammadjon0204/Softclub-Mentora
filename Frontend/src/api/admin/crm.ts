import { apiClient } from '../client';

/** `Backend/src/MentorTaskFlow.Contracts/Integrations/CrmDtos.cs`. Даты — календарные дни (Душанбе). */
export interface CrmRef {
  id: number;
  name: string;
}

export interface CrmStatus {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  keyName?: string | null;
  serverTime?: string | null;
  latencyMs?: number | null;
  error?: string | null;
  branches: CrmRef[];
  courses: CrmRef[];
}

export type CrmGroupStatus = 'Started' | 'Finished' | 'Preparing';

export interface CrmGroup {
  id: number;
  name: string;
  course: CrmRef;
  branch: CrmRef;
  status: CrmGroupStatus;
  biWeekly: boolean;
  startsOn: string;
  finishesOn: string;
  enrolledStudents: number;
  requiredStudents: number;
  currentMentors: string[];
}

export interface CrmGroupMentor {
  id: number;
  fullName: string;
  role: string;
  from: string;
  to?: string | null;
}

export interface CrmGroupStudent {
  id: number;
  fullName: string;
  status: string;
  joinedOn: string;
  leftOn?: string | null;
  note?: string | null;
}

export interface CrmIssue {
  code: string;
  message: string;
}

export interface CrmStudentScore {
  studentId: number;
  fullName: string;
  total: number;
  attendancePoints: number;
  homeworkPoints: number;
  bonusPoints: number;
  examGrade?: number | null;
  lessonsCounted: number;
  attended: number;
  absent: number;
  lateDays: { date: string; minutes: number; note?: string | null }[];
  absentDays: { date: string; kind: 'Absence' | 'Excused' | 'Unmarked'; note?: string | null }[];
  zeroHomeworkDays: string[];
  issues: CrmIssue[];
}

export interface CrmPeriod {
  week: number;
  label: string;
  isComplete: boolean;
  examMax: number;
  from: string;
  to: string;
  hasExam: boolean;
  mentors: string[];
  summary: { students: number; averageTotal?: number | null; passed: number; attendanceRate?: number | null; issueCount: number };
  students: CrmStudentScore[];
}

export interface CrmGroupPreview {
  group: CrmGroup;
  mentors: CrmGroupMentor[];
  students: CrmGroupStudent[];
  periods: CrmPeriod[];
  journalUnavailable?: string | null;
}

export const CRM_QUERY_KEYS = {
  status: ['crm', 'status'] as const,
  groups: (status: CrmGroupStatus) => ['crm', 'groups', status] as const,
  group: (id: number) => ['crm', 'group', id] as const,
};

export async function getCrmStatus(): Promise<CrmStatus> {
  const { data } = await apiClient.get<CrmStatus>('/api/v1/integrations/crm/status');
  return data;
}

export async function getCrmGroups(status: CrmGroupStatus): Promise<CrmGroup[]> {
  const { data } = await apiClient.get<{ groups: CrmGroup[] }>('/api/v1/integrations/crm/groups', { params: { status } });
  return data.groups;
}

export async function getCrmGroup(id: number): Promise<CrmGroupPreview> {
  const { data } = await apiClient.get<CrmGroupPreview>(`/api/v1/integrations/crm/groups/${String(id)}`);
  return data;
}

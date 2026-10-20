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

export type CrmFill = 'Full' | 'Partial' | 'Empty';
/** 80+ — проходит, 70–79 — нужна поддержка, ниже 70 — зона риска. */
export type CrmZone = 'Pass' | 'Support' | 'Risk';

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
  /** Насколько ментор заполнил неделю (только дни, когда студент был в группе). В средний идёт только Full. */
  fill: CrmFill;
  zone: CrmZone;
  expectedDays: number;
  filledDays: number;
  lateDays: { date: string; minutes: number; note?: string | null }[];
  /** Только то, что ментор отметил как пропуск / «отпросился». */
  absentDays: { date: string; kind: 'Absence' | 'Excused'; note?: string | null }[];
  /** Дни, которые ментор ещё не заполнил — это не пропуск. */
  unfilledDays: string[];
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
  summary: {
    students: number;
    averageTotal?: number | null;
    passed: number;
    support: number;
    risk: number;
    attendanceRate?: number | null;
    fillRate?: number | null;
    partialStudents: number;
    emptyStudents: number;
    issueCount: number;
  };
  students: CrmStudentScore[];
}

/** Студент по закрытым неделям: средний из итогов полностью заполненных недель (не сумма). */
export interface CrmStudentOverall {
  studentId: number;
  fullName: string;
  averageTotal?: number | null;
  zone?: CrmZone | null;
  weeks: number;
  fullWeeks: number;
  partialWeeks: number;
  emptyWeeks: number;
  minTotal?: number | null;
  maxTotal?: number | null;
  attended: number;
  absent: number;
  late: number;
}

export interface CrmOverall {
  periods: number;
  students: number;
  averageTotal?: number | null;
  passed: number;
  support: number;
  risk: number;
  attendanceRate?: number | null;
  fillRate?: number | null;
  studentResults: CrmStudentOverall[];
}

export interface CrmGroupPreview {
  group: CrmGroup;
  mentors: CrmGroupMentor[];
  students: CrmGroupStudent[];
  periods: CrmPeriod[];
  overall: CrmOverall;
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

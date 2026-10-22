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
  /** Прошедший день без галочки «был». kind — причина: пропуск / отпросился / другое / без причины / нет отметки в CRM. */
  absentDays: { date: string; kind: 'Absence' | 'Excused' | 'Other' | 'NoReason' | 'NoMark'; note?: string | null }[];
  /** Замечания ментора: культура, списывание, поведение, «другое» в день, когда студент был. */
  remarks: { date: string; kind: 'CultureViolation' | 'Cheating' | 'BadBehavior' | 'Other'; text: string; author?: string | null }[];
  /** Сегодня и дальше: ещё не отмечено — это не пропуск. */
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

/**
 * Что человек видит из CRM: `Organization` — всё, `Branch` — свой филиал, `Team` — группы своих
 * менторов (тимлид), `Own` — свои группы (ментор). `ready=false` — не хватает связи, `message` — какой.
 */
export interface CrmAccess {
  scope: 'Organization' | 'Branch' | 'Team' | 'Own';
  ready: boolean;
  message?: string | null;
  linkedMentors: number;
  /** Ментор или тимлид без связи с CRM — может связаться сам, поделившись номером в боте. */
  canSelfLink: boolean;
  telegramBound: boolean;
  botUrl?: string | null;
  /** На сервере задан ключ CRM. Без него групп нет ни у кого. */
  configured: boolean;
}

export interface CrmMentorLink {
  crmMentorId: number;
  fullName: string;
  phone?: string | null;
  branch?: string | null;
  isActive: boolean;
  currentGroups: number;
  linkedUserId?: string | null;
  linkedUserName?: string | null;
  suggestedUserId?: string | null;
  suggestedUserName?: string | null;
}

export interface CrmBranchLink {
  crmBranchId: number;
  name: string;
  linkedBranchId?: string | null;
  linkedBranchName?: string | null;
  suggestedBranchId?: string | null;
}

export interface CrmLinks {
  mentors: CrmMentorLink[];
  branches: CrmBranchLink[];
  users: { id: string; fullName: string; role: string; branch?: string | null; crmMentorId?: number | null }[];
  mentoraBranches: { id: string; name: string; crmBranchId?: number | null }[];
}

export const CRM_QUERY_KEYS = {
  status: ['crm', 'status'] as const,
  access: ['crm', 'access'] as const,
  links: ['crm', 'links'] as const,
  groups: (status: CrmGroupStatus) => ['crm', 'groups', status] as const,
  group: (id: number) => ['crm', 'group', id] as const,
};

export async function getCrmAccess(): Promise<CrmAccess> {
  const { data } = await apiClient.get<CrmAccess>('/api/v1/integrations/crm/access');
  return data;
}

export async function getCrmLinks(): Promise<CrmLinks> {
  const { data } = await apiClient.get<CrmLinks>('/api/v1/integrations/crm/links');
  return data;
}

export async function linkCrmMentor(crmMentorId: number, userId: string | null): Promise<void> {
  await apiClient.put(`/api/v1/integrations/crm/links/mentors/${String(crmMentorId)}`, { userId });
}

export async function linkCrmBranch(crmBranchId: number, branchId: string | null): Promise<void> {
  await apiClient.put(`/api/v1/integrations/crm/links/branches/${String(crmBranchId)}`, { branchId });
}

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

/* ----------------------------- отчёты ментора ------------------------------ */

/** Отчёт ментора по группе за период. `period` — цифры на момент отчёта (их и читает тимлид). */
export interface CrmGroupReport {
  id: string;
  crmGroupId: number;
  groupName: string;
  courseName: string;
  week: number;
  periodLabel: string;
  from: string;
  to: string;
  status: 'Draft' | 'Sent';
  authorId: string;
  authorName: string;
  isMine: boolean;
  canEdit: boolean;
  conclusions: string;
  aiModel?: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  /** После отчёта журнал в CRM поправили — черновик можно обновить. */
  dataChanged: boolean;
  period: CrmPeriod;
  /** Предыдущая неделя — для «было → стало»; null у первой недели группы. */
  previousPeriod?: CrmPeriod | null;
}

export interface CrmReportState {
  report?: CrmGroupReport | null;
  canCreate: boolean;
  cannotCreate?: string | null;
  /** Чужой черновик: кто его готовит. */
  blocked?: string | null;
  aiAvailable: boolean;
  aiError?: string | null;
}

export interface CrmReportListItem {
  id: string;
  crmGroupId: number;
  groupName: string;
  courseName: string;
  week: number;
  periodLabel: string;
  from: string;
  to: string;
  status: 'Draft' | 'Sent';
  authorName: string;
  isMine: boolean;
  updatedAt: string;
  sentAt?: string | null;
  averageTotal?: number | null;
  passed: number;
  support: number;
  risk: number;
}

export const CRM_REPORT_KEYS = {
  state: (groupId: number, week: number) => ['crm', 'report', groupId, week] as const,
  list: ['crm', 'reports'] as const,
  one: (id: string) => ['crm', 'reports', id] as const,
};

const reportUrl = (groupId: number, week: number): string =>
  `/api/v1/integrations/crm/groups/${String(groupId)}/weeks/${String(week)}/report`;

export async function getCrmReportState(groupId: number, week: number): Promise<CrmReportState> {
  const { data } = await apiClient.get<CrmReportState>(reportUrl(groupId, week));
  return data;
}

export async function createCrmReport(groupId: number, week: number): Promise<CrmReportState> {
  const { data } = await apiClient.post<CrmReportState>(reportUrl(groupId, week));
  return data;
}

export async function saveCrmReport(groupId: number, week: number, conclusions: string): Promise<CrmReportState> {
  const { data } = await apiClient.put<CrmReportState>(reportUrl(groupId, week), { conclusions });
  return data;
}

export async function redraftCrmReport(groupId: number, week: number): Promise<CrmReportState> {
  const { data } = await apiClient.post<CrmReportState>(`${reportUrl(groupId, week)}/redraft`);
  return data;
}

export async function refreshCrmReport(groupId: number, week: number): Promise<CrmReportState> {
  const { data } = await apiClient.post<CrmReportState>(`${reportUrl(groupId, week)}/refresh`);
  return data;
}

export async function sendCrmReport(groupId: number, week: number): Promise<CrmReportState> {
  const { data } = await apiClient.post<CrmReportState>(`${reportUrl(groupId, week)}/send`);
  return data;
}

export async function listCrmReports(): Promise<CrmReportListItem[]> {
  const { data } = await apiClient.get<{ reports: CrmReportListItem[] }>('/api/v1/integrations/crm/reports');
  return data.reports;
}

export async function getCrmReport(id: string): Promise<CrmGroupReport> {
  const { data } = await apiClient.get<CrmGroupReport>(`/api/v1/integrations/crm/reports/${id}`);
  return data;
}

import { apiGet } from '@/lib/api';

export interface CrmAccess {
  scope: 'Organization' | 'Branch' | 'Team' | 'Own';
  ready: boolean;
  message?: string | null;
  configured: boolean;
  canSelfLink: boolean;
  botUrl?: string | null;
}

export interface CrmStatus {
  configured: boolean;
  connected: boolean;
  keyName?: string | null;
  latencyMs?: number | null;
  error?: string | null;
}

export type CrmGroupStatus = 'Started' | 'Finished' | 'Preparing';

export interface CrmGroup {
  id: number;
  name: string;
  course: { id: number; name: string };
  branch: { id: number; name: string };
  startsOn: string;
  finishesOn: string;
  enrolledStudents: number;
  requiredStudents: number;
  currentMentors: string[];
}

export interface CrmStudentOverall {
  studentId: number;
  fullName: string;
  averageTotal?: number | null;
  zone?: string | null;
  weeks: number;
  attended: number;
  absent: number;
  late: number;
}

export interface CrmPeriod {
  week: number;
  label: string;
  isComplete: boolean;
  from: string;
  to: string;
  summary: { students: number; averageTotal?: number | null; passed: number; support: number; risk: number; attendanceRate?: number | null };
  students: { studentId: number; fullName: string; total: number; attended: number; absent: number; zone: string }[];
}

export interface CrmGroupPreview {
  group: CrmGroup;
  mentors: { id: number; fullName: string; role: string; from: string; to?: string | null }[];
  periods: CrmPeriod[];
  overall: { averageTotal?: number | null; passed: number; support: number; risk: number; attendanceRate?: number | null; studentResults: CrmStudentOverall[] };
  journalUnavailable?: string | null;
}

export const getCrmAccess = () => apiGet<CrmAccess>('/api/v1/integrations/crm/access');
export const getCrmStatus = () => apiGet<CrmStatus>('/api/v1/integrations/crm/status');
export const getCrmGroups = async (status: CrmGroupStatus) =>
  (await apiGet<{ groups: CrmGroup[] }>(`/api/v1/integrations/crm/groups?status=${status}`)).groups;
export const getCrmGroup = (id: number) => apiGet<CrmGroupPreview>(`/api/v1/integrations/crm/groups/${id}`);

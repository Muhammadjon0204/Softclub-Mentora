import { apiGet, apiGetAll, apiSend } from '@/lib/api';

export type ProposalKind = 'MasterClass' | 'ExtraLesson' | 'Other';
export type ProposalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';

/** `ProposalDto`; null fields are omitted by the server. */
export interface Proposal {
  id: string;
  branchId: string;
  categoryName: string;
  authorId: string;
  authorFullName: string;
  kind: ProposalKind;
  title: string;
  description: string;
  preferredAt?: string | null;
  status: ProposalStatus;
  decidedByFullName?: string | null;
  decidedAt?: string | null;
  decisionComment?: string | null;
  assignmentId?: string | null;
  createdAt: string;
  concurrencyToken: string;
  canDecide: boolean;
}

export const listProposals = () => apiGetAll<Proposal>('/api/v1/proposals');
export const getProposal = (id: string) => apiGet<Proposal>(`/api/v1/proposals/${id}`);

export interface ProposalInput {
  kind: ProposalKind;
  title: string;
  description: string;
  preferredAt: string | null;
}

export const createProposal = (input: ProposalInput) => apiSend<Proposal>('POST', '/api/v1/proposals', input);
export const updateProposal = (p: Proposal, input: ProposalInput) =>
  apiSend<Proposal>('PUT', `/api/v1/proposals/${p.id}`, { ...input, concurrencyToken: p.concurrencyToken });
export const withdrawProposal = (p: Proposal) => apiSend<Proposal>('POST', `/api/v1/proposals/${p.id}/withdraw`, { concurrencyToken: p.concurrencyToken });
export const approveProposal = (p: Proposal, dueAt: string, comment: string | null) =>
  apiSend<Proposal>('POST', `/api/v1/proposals/${p.id}/approve`, { dueAt, title: null, description: null, comment, concurrencyToken: p.concurrencyToken }, p.branchId);
export const rejectProposal = (p: Proposal, comment: string) =>
  apiSend<Proposal>('POST', `/api/v1/proposals/${p.id}/reject`, { comment, concurrencyToken: p.concurrencyToken }, p.branchId);

export interface Duration {
  medianHours?: number | null;
  meanHours?: number | null;
  sampleSize: number;
}

/** Rates are percentages (0–100); absent means «nothing to count», not zero. */
export interface Metrics {
  totalAssignments: number;
  approvedAssignments: number;
  firstPassApprovalRate?: number | null;
  initialSubmissionTime: Duration;
  firstReviewResponseTime: Duration;
  finalReviewTime: Duration;
  totalCycleTime: Duration;
  averageVersions?: number | null;
  overdueRate?: number | null;
  lateSubmissionRate?: number | null;
}

export interface Report {
  from: string;
  to: string;
  total: Metrics;
  rows: { branch?: { id: string; name: string } | null; categoryName?: string | null; mentorId?: string | null; mentorFullName?: string | null; metrics: Metrics }[];
}

export const getReport = (kind: 'personal' | 'team' | 'branches', from: string | null, to: string | null) => {
  const query = [from ? `from=${from}` : null, to ? `to=${to}` : null].filter(Boolean).join('&');
  return apiGet<Report>(`/api/v1/reports/${kind}${query ? `?${query}` : ''}`);
};

export interface AiSummary {
  content: string;
  disclaimer: string;
  generatedAt: string;
}

export const aiSummary = (scope: 'Personal' | 'Team' | 'Branch' | 'Organization', from: string | null, to: string | null) =>
  apiSend<AiSummary>('POST', '/api/v1/reports/ai-summary', { scope, ...(from ? { from } : {}), ...(to ? { to } : {}) });

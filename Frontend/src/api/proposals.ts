import { apiClient } from './client';
import type { PagedResult } from './lead/assignments';

/** `Backend/src/MentorTaskFlow.Contracts/Proposals/ProposalDtos.cs`. */
export type ProposalKind = 'MasterClass' | 'ExtraLesson' | 'Other';
export type ProposalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';

export interface ProposalDto {
  id: string;
  branchId: string;
  categoryId: string;
  categoryName: string;
  authorId: string;
  authorFullName: string;
  kind: ProposalKind;
  title: string;
  description: string;
  preferredAt: string | null;
  status: ProposalStatus;
  decidedById: string | null;
  decidedByFullName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  assignmentId: string | null;
  createdAt: string;
  concurrencyToken: string;
  /** Решает лид направления; администратор только если лида нет. Считает сервер. */
  canDecide: boolean;
}

export interface ProposalListQuery {
  page?: number;
  pageSize?: number;
  status?: ProposalStatus;
}

export interface ProposalDraft {
  kind: ProposalKind;
  title: string;
  description: string;
  preferredAt: string | null;
}

export interface ApproveProposalRequest {
  dueAt: string;
  title: string | null;
  description: string | null;
  comment: string | null;
  concurrencyToken: string;
}

/** Сервер не пишет в JSON поля со значением `null`: здесь они становятся теми `null`, что обещает тип. */
function normalize(dto: ProposalDto): ProposalDto {
  return {
    ...dto,
    preferredAt: dto.preferredAt ?? null,
    decidedById: dto.decidedById ?? null,
    decidedByFullName: dto.decidedByFullName ?? null,
    decidedAt: dto.decidedAt ?? null,
    decisionComment: dto.decisionComment ?? null,
    assignmentId: dto.assignmentId ?? null,
  };
}

export async function listProposals(query: ProposalListQuery = {}): Promise<PagedResult<ProposalDto>> {
  const { data } = await apiClient.get<PagedResult<ProposalDto>>('/api/v1/proposals', { params: query });
  return { ...data, items: data.items.map(normalize) };
}

export async function createProposal(draft: ProposalDraft): Promise<ProposalDto> {
  const { data } = await apiClient.post<ProposalDto>('/api/v1/proposals', draft);
  return normalize(data);
}

export async function updateProposal(id: string, draft: ProposalDraft, concurrencyToken: string): Promise<ProposalDto> {
  const { data } = await apiClient.put<ProposalDto>(`/api/v1/proposals/${id}`, { ...draft, concurrencyToken });
  return normalize(data);
}

export async function withdrawProposal(id: string, concurrencyToken: string): Promise<ProposalDto> {
  const { data } = await apiClient.post<ProposalDto>(`/api/v1/proposals/${id}/withdraw`, { concurrencyToken });
  return normalize(data);
}

export async function approveProposal(id: string, request: ApproveProposalRequest): Promise<ProposalDto> {
  const { data } = await apiClient.post<ProposalDto>(`/api/v1/proposals/${id}/approve`, request);
  return normalize(data);
}

export async function rejectProposal(id: string, comment: string, concurrencyToken: string): Promise<ProposalDto> {
  const { data } = await apiClient.post<ProposalDto>(`/api/v1/proposals/${id}/reject`, { comment, concurrencyToken });
  return normalize(data);
}

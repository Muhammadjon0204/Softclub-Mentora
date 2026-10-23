import { apiClient } from './client';

/** `Backend/src/MentorTaskFlow.Contracts/Analytics/AiSummaryDtos.cs`. */
export type AiSummaryScope = 'Personal' | 'Team' | 'Branch' | 'Organization';

export interface AiSummaryRequest {
  scope: AiSummaryScope;
  /** Календарные дни `YYYY-MM-DD`; без них — период по умолчанию на сервере. */
  from?: string;
  to?: string;
  mentorId?: string;
  includeCancelled?: boolean;
  /** Пересоздать, не беря из кэша (не чаще раза в сутки). */
  force?: boolean;
}

export interface AiSummary {
  id: string;
  scope: AiSummaryScope;
  from: string;
  to: string;
  isPartialPeriod: boolean;
  modelId: string;
  fromCache: boolean;
  generatedAt: string;
  content: string;
  disclaimer: string;
}

/** `POST /reports/ai-summary` — 404, если ИИ выключен на сервере; 429 — лимит; 503 — ИИ недоступен. */
export async function generateAiSummary(request: AiSummaryRequest): Promise<AiSummary> {
  const { data } = await apiClient.post<AiSummary>('/api/v1/reports/ai-summary', request);
  return data;
}

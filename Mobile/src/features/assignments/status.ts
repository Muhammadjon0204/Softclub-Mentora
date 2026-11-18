import type { Palette } from '@/constants/theme';

import type { AssignmentStatus } from './api';

/** Same words as the site (`LEAD_ASSIGNMENT_STATUS_LABEL`), so the shared catalogs translate them. */
export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  Draft: 'Черновик',
  Suggested: 'Предложено',
  Assigned: 'Назначено',
  Submitted: 'Отправлено',
  InReview: 'На проверке',
  NeedsRework: 'На доработке',
  Overdue: 'Просрочено',
  Approved: 'Одобрено',
  Cancelled: 'Отменено',
};

export type Tone = 'neutral' | 'brand' | 'warning' | 'danger' | 'success';

export const STATUS_TONE: Record<AssignmentStatus, Tone> = {
  Draft: 'neutral',
  Suggested: 'neutral',
  Assigned: 'brand',
  Submitted: 'brand',
  InReview: 'brand',
  NeedsRework: 'warning',
  Overdue: 'danger',
  Approved: 'success',
  Cancelled: 'neutral',
};

export function toneColors(tone: Tone, c: Palette): { fg: string; bg: string } {
  switch (tone) {
    case 'brand':
      return { fg: c.brand, bg: c.brandSoft };
    case 'warning':
      return { fg: c.warning, bg: c.warningSoft };
    case 'danger':
      return { fg: c.danger, bg: c.dangerSoft };
    case 'success':
      return { fg: c.success, bg: c.successSoft };
    default:
      return { fg: c.textSecondary, bg: c.surfaceMuted };
  }
}

/** Same rule as the site's `canSubmit` (without the late-submission flag, which the list does not carry). */
export function isActionable(status: AssignmentStatus): boolean {
  return status === 'Assigned' || status === 'NeedsRework' || status === 'Overdue';
}

/** History entries — the same wording as the site's timeline (`TASK_EVENT_LABEL` + extras). */
export const EVENT_LABEL: Record<string, string> = {
  DraftCreated: 'Черновик создан',
  Assigned: 'Назначено',
  SubmissionUploaded: 'Отправлено на проверку',
  LateSubmissionUploaded: 'Отправлено с опозданием',
  ReviewStarted: 'Взято на проверку',
  ReviewApproved: 'Одобрено',
  ReviewNeedsRework: 'Возвращено на доработку',
  MarkedOverdue: 'Помечено как просроченное',
  Cancelled: 'Отменено',
  SuggestedCreated: 'Предложено планировщиком',
  SuggestionAccepted: 'Предложение принято',
  Reassigned: 'Переназначено',
  DeadlineChanged: 'Срок изменён',
};

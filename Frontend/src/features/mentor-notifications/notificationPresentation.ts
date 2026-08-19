import { Bell, ClipboardCheck, ClipboardList, MessageSquare } from 'lucide-react';
import type { ComponentType } from 'react';

import type { MentorNotificationCategory } from './mentorNotificationSource';

export const NOTIFICATION_CATEGORY_LABEL: Record<MentorNotificationCategory, string> = {
  assignments: 'Задания',
  submissions: 'Проверки',
  feedback: 'Обратная связь',
  system: 'Система',
};

export const NOTIFICATION_CATEGORY_ICON: Record<MentorNotificationCategory, ComponentType<{ className?: string }>> = {
  assignments: ClipboardList,
  submissions: ClipboardCheck,
  feedback: MessageSquare,
  system: Bell,
};

export const NOTIFICATION_CATEGORY_TONE: Record<MentorNotificationCategory, string> = {
  assignments: 'text-ink-secondary bg-surface-muted',
  submissions: 'text-info bg-info-soft',
  feedback: 'text-success bg-success-soft',
  system: 'text-ink-disabled bg-surface-muted',
};

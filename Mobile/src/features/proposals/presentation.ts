import { BookOpenCheck, GraduationCap, Lightbulb, type LucideIcon } from 'lucide-react-native';

import type { ProposalKind, ProposalStatus } from '@/api/work';
import type { Tone } from '@/features/assignments/status';

export const PROPOSAL_KIND: Record<ProposalKind, { label: string; icon: LucideIcon }> = {
  MasterClass: { label: 'Мастер-класс', icon: GraduationCap },
  ExtraLesson: { label: 'Дополнительные уроки', icon: BookOpenCheck },
  Other: { label: 'Другая идея', icon: Lightbulb },
};

export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; tone: Tone }> = {
  Pending: { label: 'На рассмотрении', tone: 'warning' },
  Approved: { label: 'Принято', tone: 'success' },
  Rejected: { label: 'Отклонено', tone: 'danger' },
  Withdrawn: { label: 'Отозвано', tone: 'neutral' },
};

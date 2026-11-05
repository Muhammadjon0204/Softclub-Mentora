import { BookOpenCheck, GraduationCap, Lightbulb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ProposalKind, ProposalStatus } from '../../api/proposals';
import type { BadgeTone } from '../../shared/ui/Badge';

export const PROPOSAL_KIND: Record<ProposalKind, { label: string; icon: LucideIcon }> = {
  MasterClass: { label: 'Мастер-класс', icon: GraduationCap },
  ExtraLesson: { label: 'Дополнительные уроки', icon: BookOpenCheck },
  Other: { label: 'Другая идея', icon: Lightbulb },
};

export const PROPOSAL_KINDS: ProposalKind[] = ['MasterClass', 'ExtraLesson', 'Other'];

export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; tone: BadgeTone }> = {
  Pending: { label: 'На рассмотрении', tone: 'warning' },
  Approved: { label: 'Принято', tone: 'success' },
  Rejected: { label: 'Отклонено', tone: 'danger' },
  Withdrawn: { label: 'Отозвано', tone: 'neutral' },
};

export type ProposalFilter = 'all' | ProposalStatus;

export const PROPOSAL_FILTERS: { id: ProposalFilter; label: string }[] = [
  { id: 'Pending', label: 'На рассмотрении' },
  { id: 'Approved', label: 'Принятые' },
  { id: 'Rejected', label: 'Отклонённые' },
  { id: 'all', label: 'Все' },
];

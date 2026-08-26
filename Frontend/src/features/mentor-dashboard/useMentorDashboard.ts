import { useMemo } from 'react';

import { DAY_MS } from '../../mocks/domain/reference';
import { taskEventLabel } from '../mentor/assignments/mentorAssignmentPresentation';
import { formatRelative, mentorNow } from '../mentor/scope/mentorDateFormat';
import { useScopedMentorAssignmentsWithEvents } from '../mentor/scope/useScopedMentorAssignments';
import type { LeadTaskEventRecord } from '../../mocks/ui-preview/leadAssignments.preview';

export interface MentorDashboardKpis {
  awaitingReview: number;
  activeAssignments: number;
  rework: number;
  overdue: number;
  approvedPeriod: number;
}

export type AttentionReason = 'overdue' | 'waiting-review' | 'rework-due-soon' | 'in-review-long';

export interface AttentionItem {
  id: string;
  reason: AttentionReason;
  title: string;
  detailLabel: string;
  targetPath: string;
  urgencyRank: number;
}

export interface RecentActivityItem {
  id: string;
  kind: LeadTaskEventRecord['kind'];
  label: string;
  assignmentTitle: string;
  occurredAt: number;
  targetPath: string;
}

const PERIOD_DAYS = 30;
const ATTENTION_LIMIT = 7;
const ACTIVITY_LIMIT = 8;

/**
 * Единая точка агрегации Mentor Dashboard — порт `useLeadDashboard.ts` под
 * scope одного Mentor (`useScopedMentorAssignmentsWithEvents`, уже
 * отфильтрован по `mentorId`), без командных/team-метрик, которых у Mentor
 * по ролевой модели нет (ТЗ 8.4 — Mentor не видит показатели других
 * менторов).
 *
 * Использует именно `...WithEvents`, а не голый `useScopedMentorAssignments`
 * — иначе `recentActivity` ниже читает `a.events` с записей, где это поле
 * никогда не гидратируется (см. doc comment хука), и виджет "Последняя
 * активность" молча остаётся пустым при любом реальном количестве событий;
 * найдено и исправлено при первой живой проверке (2026-08-22).
 */
export function useMentorDashboard(): {
  kpis: MentorDashboardKpis;
  attentionItems: AttentionItem[];
  recentActivity: RecentActivityItem[];
} {
  const assignments = useScopedMentorAssignmentsWithEvents();

  return useMemo(() => {
    const now = mentorNow();
    const active = assignments.filter((a) => ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'].includes(a.status));
    const awaitingReview = assignments.filter((a) => a.status === 'Submitted' || a.status === 'InReview');
    const rework = assignments.filter((a) => a.status === 'NeedsRework');
    const overdue = assignments.filter((a) => a.status === 'Overdue');
    const approvedPeriod = assignments.filter((a) => a.status === 'Approved' && a.approvedAt !== null && now - a.approvedAt <= PERIOD_DAYS * DAY_MS);

    const kpis: MentorDashboardKpis = {
      awaitingReview: awaitingReview.length,
      activeAssignments: active.length,
      rework: rework.length,
      overdue: overdue.length,
      approvedPeriod: approvedPeriod.length,
    };

    const attentionCandidates: AttentionItem[] = [];

    for (const a of overdue) {
      const overdueSince = a.overdueAt ?? a.currentDueAt;
      attentionCandidates.push({
        id: `overdue-${a.id}`,
        reason: 'overdue',
        title: a.title,
        detailLabel: `Просрочено ${formatRelative(overdueSince).label}`,
        targetPath: `/mentor/tasks?assignmentId=${a.id}`,
        urgencyRank: 1000 + (now - overdueSince),
      });
    }

    for (const a of assignments.filter((x) => x.status === 'Submitted')) {
      const waitingSince = a.firstSubmittedAt ?? a.assignedAt ?? now;
      attentionCandidates.push({
        id: `waiting-${a.id}`,
        reason: 'waiting-review',
        title: a.title,
        detailLabel: `Отправлено ${formatRelative(waitingSince).label}`,
        targetPath: `/mentor/tasks?assignmentId=${a.id}`,
        urgencyRank: 800 + (now - waitingSince) / DAY_MS,
      });
    }

    for (const a of rework) {
      const dueIn = a.currentDueAt - now;
      if (dueIn <= DAY_MS) {
        attentionCandidates.push({
          id: `rework-${a.id}`,
          reason: 'rework-due-soon',
          title: a.title,
          detailLabel: `Новый дедлайн ${formatRelative(a.currentDueAt).label}`,
          targetPath: `/mentor/tasks?assignmentId=${a.id}`,
          urgencyRank: 600 - dueIn / DAY_MS,
        });
      }
    }

    for (const a of assignments.filter((x) => x.status === 'InReview')) {
      const reviewingSince = a.reviewStartedAt ?? now;
      if (now - reviewingSince >= DAY_MS) {
        attentionCandidates.push({
          id: `inreview-${a.id}`,
          reason: 'in-review-long',
          title: a.title,
          detailLabel: `На проверке у руководителя ${formatRelative(reviewingSince).label}`,
          targetPath: `/mentor/tasks?assignmentId=${a.id}`,
          urgencyRank: 400 + (now - reviewingSince) / DAY_MS,
        });
      }
    }

    const attentionItems = attentionCandidates.sort((a, b) => b.urgencyRank - a.urgencyRank).slice(0, ATTENTION_LIMIT);

    const activityEntries: RecentActivityItem[] = [];
    for (const a of assignments) {
      for (const event of a.events) {
        activityEntries.push({
          id: event.id,
          kind: event.kind,
          label: taskEventLabel(event),
          assignmentTitle: a.title,
          occurredAt: event.occurredAt,
          targetPath: `/mentor/tasks?assignmentId=${a.id}`,
        });
      }
    }
    const recentActivity = activityEntries.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, ACTIVITY_LIMIT);

    return { kpis, attentionItems, recentActivity };
  }, [assignments]);
}

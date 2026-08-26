import { useMemo } from 'react';

import { DAY_MS } from '../../mocks/domain/reference';
import type { LeadAssignmentRecord, LeadAssignmentStatus } from '../../mocks/ui-preview/leadAssignments.preview';
import { formatOffsetHoursAgo, formatRelative, leadNow } from '../lead/scope/leadDateFormat';
import { scopedActiveMentors } from '../lead/scope/leadScopedData';
import { useLeadScope } from '../lead/scope/useLeadScope';
import { useScopedLeadAssignments } from '../lead/scope/useScopedLeadAssignments';

export interface LeadDashboardKpis {
  active: number;
  awaitingReview: number;
  rework: number;
  overdue: number;
  approvedPeriod: number;
}

export type PriorityReason = 'overdue' | 'waiting-review' | 'rework-due-soon' | 'in-review-long';

export interface PriorityQueueItem {
  assignmentId: string;
  title: string;
  mentorName: string;
  status: LeadAssignmentStatus;
  reason: PriorityReason;
  detailLabel: string;
  targetPath: string;
  urgencyRank: number;
}

export interface TeamSummaryRow {
  mentorId: string;
  fullName: string;
  status: 'Active' | 'Invited' | 'Locked';
  activeCount: number;
  reworkCount: number;
  lastActiveLabel: string;
}

export interface ActivityPoint {
  dateLabel: string;
  assigned: number;
  submitted: number;
  approved: number;
}

const PERIOD_DAYS = 30;

function mentorNameFallback(mentorId: string, mentors: ReturnType<typeof scopedActiveMentors>): string {
  return mentors.find((m) => m.id === mentorId)?.fullName ?? 'Ментор';
}

function buildActivitySeries(assignments: LeadAssignmentRecord[], now: number): ActivityPoint[] {
  const days = 14;
  const buckets: ActivityPoint[] = Array.from({ length: days }, (_, index) => {
    const dayStart = now - (days - 1 - index) * DAY_MS;
    const label = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(dayStart);
    return { dateLabel: label, assigned: 0, submitted: 0, approved: 0 };
  });

  const bucketIndexOf = (ts: number): number | null => {
    const diffDays = Math.floor((now - ts) / DAY_MS);
    const index = days - 1 - diffDays;
    return index >= 0 && index < days ? index : null;
  };

  for (const assignment of assignments) {
    for (const event of assignment.events) {
      const index = bucketIndexOf(event.occurredAt);
      if (index === null) continue;
      if (event.kind === 'Assigned') buckets[index].assigned += 1;
      else if (event.kind === 'SubmissionUploaded' || event.kind === 'LateSubmissionUploaded') buckets[index].submitted += 1;
      else if (event.kind === 'ReviewApproved') buckets[index].approved += 1;
    }
  }

  return buckets;
}

/**
 * Единая точка агрегации Dashboard Lead. Считает исключительно по
 * `useScopedLeadAssignments()` (уже отфильтрован по Category) — ни одно
 * значение здесь не может утечь из чужой категории, потому что источник
 * данных сам не содержит чужих записей (раздел 42 задачи Phase 3 — KPI не
 * должны агрегировать global data при scoped table).
 */
export function useLeadDashboard(): {
  kpis: LeadDashboardKpis;
  priorityItems: PriorityQueueItem[];
  activity: ActivityPoint[];
  team: TeamSummaryRow[];
} {
  const scope = useLeadScope();
  const assignments = useScopedLeadAssignments();
  const mentors = scopedActiveMentors(scope.categoryId);

  return useMemo(() => {
    const now = leadNow();
    const nonTerminal = assignments.filter((a) => a.status !== 'Draft' && a.status !== 'Suggested' && a.status !== 'Cancelled' && a.status !== 'Approved');
    const awaitingReview = assignments.filter((a) => a.status === 'Submitted' || a.status === 'InReview');
    const rework = assignments.filter((a) => a.status === 'NeedsRework');
    const overdue = assignments.filter((a) => a.status === 'Overdue');
    const approvedPeriod = assignments.filter((a) => a.status === 'Approved' && a.approvedAt !== null && now - a.approvedAt <= PERIOD_DAYS * DAY_MS);

    const kpis: LeadDashboardKpis = {
      active: nonTerminal.length,
      awaitingReview: awaitingReview.length,
      rework: rework.length,
      overdue: overdue.length,
      approvedPeriod: approvedPeriod.length,
    };

    const priorityCandidates: PriorityQueueItem[] = [];

    for (const a of overdue) {
      const overdueSince = a.overdueAt ?? a.currentDueAt;
      priorityCandidates.push({
        assignmentId: a.id,
        title: a.title,
        mentorName: mentorNameFallback(a.mentorId, mentors),
        status: a.status,
        reason: 'overdue',
        detailLabel: `Просрочено ${formatRelative(overdueSince).label}`,
        targetPath: `/lead/assignments?assignmentId=${a.id}`,
        urgencyRank: 1000 + (now - overdueSince),
      });
    }

    for (const a of assignments.filter((x) => x.status === 'Submitted')) {
      const waitingSince = a.firstSubmittedAt ?? a.assignedAt ?? now;
      priorityCandidates.push({
        assignmentId: a.id,
        title: a.title,
        mentorName: mentorNameFallback(a.mentorId, mentors),
        status: a.status,
        reason: 'waiting-review',
        detailLabel: `Ожидает ${formatRelative(waitingSince).label.replace('назад', '').trim()}`,
        targetPath: `/lead/review-queue?assignmentId=${a.id}`,
        urgencyRank: 800 + (now - waitingSince) / DAY_MS,
      });
    }

    for (const a of rework) {
      const dueIn = a.currentDueAt - now;
      if (dueIn <= DAY_MS) {
        priorityCandidates.push({
          assignmentId: a.id,
          title: a.title,
          mentorName: mentorNameFallback(a.mentorId, mentors),
          status: a.status,
          reason: 'rework-due-soon',
          detailLabel: `Новый дедлайн ${formatRelative(a.currentDueAt).label}`,
          targetPath: `/lead/assignments?assignmentId=${a.id}`,
          urgencyRank: 600 - dueIn / DAY_MS,
        });
      }
    }

    for (const a of assignments.filter((x) => x.status === 'InReview')) {
      const reviewingSince = a.reviewStartedAt ?? now;
      if (now - reviewingSince >= DAY_MS) {
        priorityCandidates.push({
          assignmentId: a.id,
          title: a.title,
          mentorName: mentorNameFallback(a.mentorId, mentors),
          status: a.status,
          reason: 'in-review-long',
          detailLabel: `На проверке ${formatRelative(reviewingSince).label}`,
          targetPath: `/lead/review-queue?assignmentId=${a.id}`,
          urgencyRank: 400 + (now - reviewingSince) / DAY_MS,
        });
      }
    }

    const priorityItems = priorityCandidates.sort((a, b) => b.urgencyRank - a.urgencyRank).slice(0, 7);

    const team: TeamSummaryRow[] = mentors.map((mentor) => {
      const ownAssignments = assignments.filter((a) => a.mentorId === mentor.id);
      return {
        mentorId: mentor.id,
        fullName: mentor.fullName,
        status: mentor.status,
        activeCount: ownAssignments.filter((a) => ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'].includes(a.status)).length,
        reworkCount: ownAssignments.filter((a) => a.status === 'NeedsRework').length,
        lastActiveLabel: formatOffsetHoursAgo(mentor.lastActiveOffsetHours),
      };
    });

    const activity = buildActivitySeries(assignments, now);

    return { kpis, priorityItems, activity, team };
  }, [assignments, mentors]);
}

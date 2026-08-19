import { useMemo } from 'react';

import { DAY_MS, HOUR_MS, MOCK_NOW } from '../../mocks/domain/reference';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { useScopedMentorAssignments } from '../mentor/scope/useScopedMentorAssignments';

/**
 * Личная аналитика Mentor — те же формулы раздела 21 ТЗ (`ANA-001`…`ANA-009`),
 * что и `useLeadReports.ts`, но без `mentorId`-фильтра (всегда «я сам») и без
 * разбивки по менторам, которой Mentor по ролевой модели не видит
 * (Приложение A: «Личная аналитика — Да (только по себе)»).
 */

export interface ReportsFilters {
  periodDays: number | 'all';
  includeCancelled: boolean;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function inPeriod(ts: number | null, fromMs: number): boolean {
  return ts !== null && ts >= fromMs && ts <= MOCK_NOW;
}

export interface DurationMetric {
  medianHours: number | null;
  averageHours: number | null;
}

export interface ActivityPoint {
  dateLabel: string;
  assigned: number;
  submitted: number;
  approved: number;
}

export interface MentorReportsResult {
  totalAssignments: number;
  approvedAssignments: number;
  firstPassApprovalRate: number | null;
  overdueRate: number | null;
  lateSubmissionRate: number | null;
  initialSubmissionTime: DurationMetric;
  firstReviewResponseTime: DurationMetric;
  finalReviewTime: DurationMetric;
  totalCycleTime: DurationMetric;
  averageVersions: number | null;
  activity: ActivityPoint[];
}

function buildActivitySeries(assignments: LeadAssignmentRecord[]): ActivityPoint[] {
  const days = 14;
  const buckets: ActivityPoint[] = Array.from({ length: days }, (_, index) => {
    const dayStart = MOCK_NOW - (days - 1 - index) * DAY_MS;
    const label = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(dayStart);
    return { dateLabel: label, assigned: 0, submitted: 0, approved: 0 };
  });

  const bucketIndexOf = (ts: number): number | null => {
    const diffDays = Math.floor((MOCK_NOW - ts) / DAY_MS);
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

export function useMentorReports(filters: ReportsFilters): MentorReportsResult {
  const all = useScopedMentorAssignments();

  return useMemo(() => {
    const fromMs = filters.periodDays === 'all' ? 0 : MOCK_NOW - filters.periodDays * DAY_MS;

    const eligible = (a: LeadAssignmentRecord): boolean => {
      if (a.status === 'Cancelled' && !filters.includeCancelled) return false;
      return true;
    };

    const scoped = all.filter(eligible);

    const totalSet = scoped.filter((a) => inPeriod(a.assignedAt, fromMs));
    const approvedSet = scoped.filter((a) => a.status === 'Approved' && inPeriod(a.approvedAt, fromMs));

    const totalAssignments = totalSet.length;
    const approvedAssignments = approvedSet.length;

    const firstPassCount = approvedSet.filter((a) => a.submissions.length === 1 && a.submissions[0].review?.decision === 'Approved').length;
    const firstPassApprovalRate = approvedAssignments === 0 ? null : Math.round((firstPassCount / approvedAssignments) * 1000) / 10;

    const overdueCount = totalSet.filter((a) => a.overdueAt !== null).length;
    const overdueRate = totalAssignments === 0 ? null : Math.round((overdueCount / totalAssignments) * 1000) / 10;

    const submissionsInPeriod = scoped.flatMap((a) => a.submissions.filter((s) => inPeriod(s.submittedAt, fromMs)));
    const lateCount = submissionsInPeriod.filter((s) => s.isLate).length;
    const lateSubmissionRate = submissionsInPeriod.length === 0 ? null : Math.round((lateCount / submissionsInPeriod.length) * 1000) / 10;

    const withSubmission = totalSet.filter((a) => a.submissions.length > 0);
    const initialSubmissionHours = withSubmission
      .filter((a) => a.firstSubmittedAt !== null && a.assignedAt !== null)
      .map((a) => (a.firstSubmittedAt! - a.assignedAt!) / HOUR_MS);

    const firstReviewHours = scoped
      .filter((a) => inPeriod(a.firstSubmittedAt, fromMs) && a.submissions.length > 0)
      .map((a) => {
        const reviewTimes = a.submissions.filter((s) => s.review !== null).map((s) => s.review!.createdAt);
        if (reviewTimes.length === 0 || a.firstSubmittedAt === null) return null;
        return (Math.min(...reviewTimes) - a.firstSubmittedAt) / HOUR_MS;
      })
      .filter((v): v is number => v !== null);

    const finalReviewHours = approvedSet
      .map((a) => {
        const last = a.submissions[a.submissions.length - 1];
        if (last?.review === null || last?.review === undefined) return null;
        return (last.review.createdAt - last.submittedAt) / HOUR_MS;
      })
      .filter((v): v is number => v !== null);

    const cycleHours = approvedSet.filter((a) => a.assignedAt !== null && a.approvedAt !== null).map((a) => (a.approvedAt! - a.assignedAt!) / HOUR_MS);

    const totalSubmissionsCount = withSubmission.reduce((sum, a) => sum + a.submissions.length, 0);
    const averageVersions = withSubmission.length === 0 ? null : Math.round((totalSubmissionsCount / withSubmission.length) * 10) / 10;

    return {
      totalAssignments,
      approvedAssignments,
      firstPassApprovalRate,
      overdueRate,
      lateSubmissionRate,
      initialSubmissionTime: { medianHours: median(initialSubmissionHours), averageHours: average(initialSubmissionHours) },
      firstReviewResponseTime: { medianHours: median(firstReviewHours), averageHours: average(firstReviewHours) },
      finalReviewTime: { medianHours: median(finalReviewHours), averageHours: average(finalReviewHours) },
      totalCycleTime: { medianHours: median(cycleHours), averageHours: average(cycleHours) },
      averageVersions,
      activity: buildActivitySeries(scoped),
    };
  }, [all, filters.periodDays, filters.includeCancelled]);
}

import { useMemo } from 'react';

import { DAY_MS, HOUR_MS } from '../../mocks/domain/reference';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { leadNow } from '../lead/scope/leadDateFormat';
import { scopedActiveMentors } from '../lead/scope/leadScopedData';
import { useLeadScope } from '../lead/scope/useLeadScope';
import { useScopedLeadAssignments } from '../lead/scope/useScopedLeadAssignments';

/**
 * Аналитика Lead — те же формулы, что раздел 21 ТЗ (`ANA-001`…`ANA-009`),
 * но БЕЗ фильтра по Branch/Category: у Lead они фиксированы (`TEN-070` —
 * «Lead: своя Category своего Branch», фильтры по Branch/Category недоступны).
 * Знаменатель = 0 → `null`, а не 0 и не ошибка (`ANA-004`).
 */

export interface ReportsFilters {
  periodDays: number | 'all';
  mentorId: string;
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

function inPeriod(ts: number | null, fromMs: number, now: number): boolean {
  return ts !== null && ts >= fromMs && ts <= now;
}

export interface DurationMetric {
  medianHours: number | null;
  averageHours: number | null;
}

export interface LeadReportsResult {
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
  mentorBreakdown: { mentorId: string; fullName: string; total: number; approved: number; overdue: number }[];
}

export function useLeadReports(filters: ReportsFilters): LeadReportsResult {
  const scope = useLeadScope();
  const all = useScopedLeadAssignments();
  const mentors = scopedActiveMentors(scope.categoryId);

  return useMemo(() => {
    const now = leadNow();
    const fromMs = filters.periodDays === 'all' ? 0 : now - filters.periodDays * DAY_MS;

    // ANA-001: Draft/Suggested никогда не включаются; Cancelled — только по фильтру.
    const eligible = (a: LeadAssignmentRecord): boolean => {
      if (a.status === 'Draft' || a.status === 'Suggested') return false;
      if (a.status === 'Cancelled' && !filters.includeCancelled) return false;
      if (filters.mentorId !== 'all' && a.mentorId !== filters.mentorId) return false;
      return true;
    };

    const scoped = all.filter(eligible);

    const totalSet = scoped.filter((a) => inPeriod(a.assignedAt, fromMs, now));
    const approvedSet = scoped.filter((a) => a.status === 'Approved' && inPeriod(a.approvedAt, fromMs, now));

    const totalAssignments = totalSet.length;
    const approvedAssignments = approvedSet.length;

    const firstPassCount = approvedSet.filter((a) => {
      if (a.submissions.length !== 1) return false;
      return a.submissions[0].review?.decision === 'Approved';
    }).length;
    const firstPassApprovalRate = approvedAssignments === 0 ? null : Math.round((firstPassCount / approvedAssignments) * 1000) / 10;

    const overdueCount = totalSet.filter((a) => a.overdueAt !== null).length;
    const overdueRate = totalAssignments === 0 ? null : Math.round((overdueCount / totalAssignments) * 1000) / 10;

    const submissionsInPeriod = scoped.flatMap((a) => a.submissions.filter((s) => inPeriod(s.submittedAt, fromMs, now)));
    const lateCount = submissionsInPeriod.filter((s) => s.isLate).length;
    const lateSubmissionRate = submissionsInPeriod.length === 0 ? null : Math.round((lateCount / submissionsInPeriod.length) * 1000) / 10;

    const withSubmission = totalSet.filter((a) => a.submissions.length > 0);
    const initialSubmissionHours = withSubmission
      .filter((a) => a.firstSubmittedAt !== null && a.assignedAt !== null)
      .map((a) => (a.firstSubmittedAt! - a.assignedAt!) / HOUR_MS);

    const firstReviewHours = scoped
      .filter((a) => inPeriod(a.firstSubmittedAt, fromMs, now) && a.submissions.length > 0)
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

    const mentorBreakdown = mentors.map((mentor) => {
      const own = totalSet.filter((a) => a.mentorId === mentor.id);
      return {
        mentorId: mentor.id,
        fullName: mentor.fullName,
        total: own.length,
        approved: approvedSet.filter((a) => a.mentorId === mentor.id).length,
        overdue: own.filter((a) => a.overdueAt !== null).length,
      };
    });

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
      mentorBreakdown,
    };
  }, [all, mentors, filters.periodDays, filters.mentorId, filters.includeCancelled]);
}

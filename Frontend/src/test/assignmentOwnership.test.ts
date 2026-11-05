import { describe, expect, it } from 'vitest';

import { assignmentCapabilities, canReschedule } from '../features/lead/assignments/leadAssignmentPresentation';
import type { LeadAssignmentRecord } from '../mocks/ui-preview/leadAssignments.preview';

function record(overrides: Partial<LeadAssignmentRecord>): LeadAssignmentRecord {
  return {
    id: 'a1',
    categoryId: 'c1',
    title: 'Задание',
    description: '',
    status: 'Assigned',
    source: 'Manual',
    mentorId: 'm1',
    assignedById: 'l1',
    topicAssignmentId: null,
    initialDueAt: 0,
    currentDueAt: 0,
    assignedAt: null,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [],
    ...overrides,
  };
}

describe('кто ведёт задание', () => {
  it('тот, кто выдал задание, может всё, что позволяет статус', () => {
    const caps = assignmentCapabilities(record({ canManage: true }));

    expect(caps.canReschedule).toBe(true);
    expect(caps.canReassign).toBe(true);
    expect(caps.canCancel).toBe(true);
  });

  it('вышестоящий только смотрит: ни срока, ни проверки, ни отмены', () => {
    const inReview = assignmentCapabilities(record({ canManage: false, status: 'InReview' }));
    const assigned = assignmentCapabilities(record({ canManage: false }));

    expect(inReview.canDecideReview).toBe(false);
    expect(assigned.canReschedule).toBe(false);
    expect(assigned.canReassign).toBe(false);
    expect(assigned.canCancel).toBe(false);
  });

  it('исполнитель сдаёт работу и без права вести задание', () => {
    expect(assignmentCapabilities(record({ canManage: false })).canSubmit).toBe(true);
  });
});

describe('смена срока', () => {
  it.each(['Assigned', 'NeedsRework', 'Overdue'] as const)('доступна, пока работа у исполнителя: %s', (status) => {
    expect(canReschedule(record({ status }))).toBe(true);
  });

  it.each(['Draft', 'Suggested', 'Submitted', 'InReview', 'Approved', 'Cancelled'] as const)('недоступна в статусе %s', (status) => {
    expect(canReschedule(record({ status }))).toBe(false);
  });
});

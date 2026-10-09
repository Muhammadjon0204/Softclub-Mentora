import { describe, expect, it } from 'vitest';

import { countdownParts, dayKeyOf, gridRangeUtc, monthGrid, shiftMonth, zonedMidnightUtc } from '../features/deadline-calendar/calendarMath';
import { isCalendarVisible, toneOf } from '../features/deadline-calendar/deadlineEvents';
import type { AssignmentDto } from '../api/lead/assignments';

describe('deadline calendar math', () => {
  it('builds a six-week Monday-first grid', () => {
    // October 2026 starts on a Thursday.
    const cells = monthGrid(2026, 10);
    expect(cells).toHaveLength(42);
    expect(cells[0].key).toBe('2026-09-28');
    expect(cells[3]).toMatchObject({ key: '2026-10-01', inMonth: true, weekday: 3 });
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(cells[41].key).toBe('2026-11-08');
  });

  it('puts a late-evening deadline on the day of the category time zone, not of UTC', () => {
    const lateEvening = Date.parse('2026-10-09T18:30:00Z'); // 23:30 in Dushanbe
    expect(dayKeyOf(lateEvening, 'Asia/Dushanbe')).toBe('2026-10-09');
    const afterMidnight = Date.parse('2026-10-09T19:30:00Z'); // 00:30 next day in Dushanbe
    expect(dayKeyOf(afterMidnight, 'Asia/Dushanbe')).toBe('2026-10-10');
  });

  it('finds local midnight as a UTC instant', () => {
    expect(new Date(zonedMidnightUtc(2026, 10, 5, 'Asia/Dushanbe')).toISOString()).toBe('2026-10-04T19:00:00.000Z');
    // A daylight-saving day: Berlin switches to winter time on 25 Oct 2026.
    expect(new Date(zonedMidnightUtc(2026, 10, 25, 'Europe/Berlin')).toISOString()).toBe('2026-10-24T22:00:00.000Z');
  });

  it('asks the server for exactly the visible grid', () => {
    const { fromMs, toMs } = gridRangeUtc({ year: 2026, month: 10 }, 'Asia/Dushanbe');
    expect(new Date(fromMs).toISOString()).toBe('2026-09-27T19:00:00.000Z');
    expect(new Date(toMs).toISOString()).toBe('2026-11-08T19:00:00.000Z');
  });

  it('shifts months across years', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('splits a countdown into days, hours, minutes and seconds', () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(countdownParts(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(countdownParts(-ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it('hides drafts, suggestions and cancelled tasks and colours the rest by state', () => {
    const dto = (status: string): AssignmentDto => ({ status } as AssignmentDto);
    expect(['Draft', 'Suggested', 'Cancelled'].map((status) => isCalendarVisible(dto(status)))).toEqual([false, false, false]);
    expect(isCalendarVisible(dto('Assigned'))).toBe(true);
    expect(['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue', 'Approved'].map(toneOf)).toEqual([
      'active', 'review', 'review', 'rework', 'overdue', 'done',
    ]);
  });
});

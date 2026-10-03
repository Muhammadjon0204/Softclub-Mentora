import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRefetchScheduler, isLiveQueryKey } from '../realtime/realtimeConnection';

describe('realtime refetch scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses a burst of events into a single invalidation', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const scheduler = createRefetchScheduler(queryClient);

    for (let i = 0; i < 20; i++) {
      scheduler.schedule();
      vi.advanceTimersByTime(10);
    }
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('never delays past one second under a continuous stream of events', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const scheduler = createRefetchScheduler(queryClient);

    for (let elapsed = 0; elapsed < 1_000; elapsed += 100) {
      scheduler.schedule();
      vi.advanceTimersByTime(100);
    }

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('refetches assignment data but leaves reference data and the session alone', () => {
    expect(isLiveQueryKey(['lead-assignments', 'list', 'org', 'cat'])).toBe(true);
    expect(isLiveQueryKey(['mentor-assignments', 'list', 'org', 'm'])).toBe(true);
    expect(isLiveQueryKey(['lead-submissions', 'a1'])).toBe(true);
    expect(isLiveQueryKey(['admin-dashboard', 'branch-scoped', 'org', 'all', '30d'])).toBe(true);

    expect(isLiveQueryKey(['auth', 'me'])).toBe(false);
    expect(isLiveQueryKey(['branches', 'org'])).toBe(false);
    expect(isLiveQueryKey(['admin-categories', 'settings', 'c'])).toBe(false);
  });
});

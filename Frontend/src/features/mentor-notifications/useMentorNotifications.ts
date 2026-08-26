import { useEffect, useMemo } from 'react';

import { mentorNow } from '../mentor/scope/mentorDateFormat';
import { useScopedMentorAssignmentsWithEvents } from '../mentor/scope/useScopedMentorAssignments';
import { DAY_MS } from '../../mocks/domain/reference';
import { markAllNotificationsRead, markNotificationRead, seedReadStateOnce, useMentorNotificationReadIds } from './mentorNotificationReadStore';
import { buildMentorNotifications } from './mentorNotificationSource';
import type { MentorNotificationRecord } from './mentorNotificationSource';

const SEED_READ_THRESHOLD_MS = 2 * DAY_MS;

export interface UseMentorNotificationsResult {
  all: MentorNotificationRecord[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/** Единая точка чтения ленты уведомлений ментора — комбинирует производные данные (`buildMentorNotifications`) с состоянием прочитанности. */
export function useMentorNotifications(): UseMentorNotificationsResult {
  const assignments = useScopedMentorAssignmentsWithEvents();
  const readIds = useMentorNotificationReadIds();

  const all = useMemo(() => buildMentorNotifications(assignments), [assignments]);

  useEffect(() => {
    const now = mentorNow();
    seedReadStateOnce(all.filter((n) => now - n.occurredAt > SEED_READ_THRESHOLD_MS).map((n) => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- посев одноразовый (см. seedReadStateOnce), пересчёт списка не должен его повторять
  }, []);

  const unreadCount = all.filter((n) => !readIds.has(n.id)).length;

  return {
    all,
    unreadCount,
    isRead: (id) => readIds.has(id),
    markRead: markNotificationRead,
    markAllRead: () => { markAllNotificationsRead(all.map((n) => n.id)); },
  };
}

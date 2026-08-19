import { useMentorNotifications } from '../../features/mentor-notifications/useMentorNotifications';
import { useScopedMentorAssignments } from '../../features/mentor/scope/useScopedMentorAssignments';

/**
 * Счётчики-бейджи для пунктов sidebar. «Мои задания» считает только то, что
 * реально требует действия Mentor (`NeedsRework`/`Overdue` — есть, что
 * загрузить), а не `Submitted`/`InReview` — те ждут решения Lead, Mentor
 * здесь ничего не делает, бейдж на них был бы ложной тревогой.
 */
export function useMentorNavBadges(): Record<string, number> {
  const assignments = useScopedMentorAssignments();
  const needsActionCount = assignments.filter((a) => a.status === 'NeedsRework' || a.status === 'Overdue').length;
  const { unreadCount } = useMentorNotifications();

  return {
    tasks: needsActionCount,
    notifications: unreadCount,
  };
}

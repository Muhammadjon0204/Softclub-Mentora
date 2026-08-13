import { useMemo } from 'react';

import { useLeadMentorsPreview } from '../team/leadMentorPreviewStore';
import type { MentorDirectoryEntry } from './leadWorkspace';
import { useLeadScope } from './useLeadScope';

/** Реактивный аналог `scopedMentors()` для страниц, которым нужно мгновенно видеть только что созданного ментора (`/lead/team`). */
export function useScopedLeadMentors(): MentorDirectoryEntry[] {
  const scope = useLeadScope();
  const all = useLeadMentorsPreview();
  return useMemo(() => all.filter((mentor) => mentor.categoryId === scope.categoryId), [all, scope.categoryId]);
}

export function useResolvedLeadMentor(mentorId: string | null): MentorDirectoryEntry | undefined {
  const scoped = useScopedLeadMentors();
  if (mentorId === null) return undefined;
  return scoped.find((mentor) => mentor.id === mentorId);
}

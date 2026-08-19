/**
 * Mentor-facing витрина над `leadAssignmentPresentation.ts` — единственным
 * источником истины о допустимых переходах общего Assignment (см.
 * `mentorAssignmentPreviewStore.ts`). Реэкспортирует то, что нужно read-only
 * стороне Mentor UI, вместо повторного вычисления статусов/капабилити.
 */
export {
  LEAD_ASSIGNMENT_STATUS_LABEL as MENTOR_ASSIGNMENT_STATUS_LABEL,
  type LeadAssignmentRecord as MentorAssignmentRecord,
  type LeadAssignmentStatus as MentorAssignmentStatus,
  type LeadSubmissionFile as MentorSubmissionFile,
  type LeadSubmissionRecord as MentorSubmissionRecord,
  type LeadTaskEventRecord as MentorTaskEventRecord,
} from '../../../mocks/ui-preview/leadAssignments.preview';

export {
  LEAD_STATUS_META as MENTOR_STATUS_META,
  assignmentCapabilities,
  canSubmit,
  isTerminal,
  latestSubmission,
  pluralizeRu,
  sourceLabel,
  taskEventLabel,
  type AssignmentCapabilities as MentorAssignmentCapabilities,
} from '../../lead/assignments/leadAssignmentPresentation';

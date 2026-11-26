import { JournalPage as Journal } from '../../features/journal/JournalPage';

/** `/mentor/journal` — всё, что происходило с заданиями ментора, и кто это сделал. */
export function JournalPage(): JSX.Element {
  return (
    <Journal
      subtitle="Всё, что происходило с вашими заданиями: кто выдал, что изменил и когда"
      taskHref={(id) => `/mentor/tasks?assignmentId=${encodeURIComponent(id)}`}
      hideAssignee
    />
  );
}

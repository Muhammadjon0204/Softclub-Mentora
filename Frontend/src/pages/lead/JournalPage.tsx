import { JournalPage as Journal } from '../../features/journal/JournalPage';

/** `/lead/journal` — задания команды и собственные действия тимлида. */
export function JournalPage(): JSX.Element {
  return (
    <Journal
      subtitle="Всё, что происходит с заданиями вашей команды, включая ваши собственные действия"
      taskHref={(id) => `/lead/assignments?assignmentId=${encodeURIComponent(id)}`}
    />
  );
}

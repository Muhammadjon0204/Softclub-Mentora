import { useAuth } from '../../auth/useAuth';
import { JournalPage as Journal } from '../../features/journal/JournalPage';

/** `/admin/journal` — организация целиком у владельца, свой филиал у администратора филиала. */
export function JournalPage(): JSX.Element {
  const { user } = useAuth();
  const branchOnly = user?.adminScope === 'Branch';
  return (
    <Journal
      title="Журнал заданий"
      subtitle={branchOnly ? 'Всё, что происходит с заданиями вашего филиала' : 'Всё, что происходит с заданиями во всех филиалах'}
      taskHref={(id) => `/admin/assignments?assignmentId=${encodeURIComponent(id)}`}
    />
  );
}

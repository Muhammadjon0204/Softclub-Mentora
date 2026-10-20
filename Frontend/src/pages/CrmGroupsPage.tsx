import { useAuth } from '../auth/useAuth';
import { CrmGroupsView } from '../features/admin-crm/CrmGroupsView';
import { PreviewPageHeader } from '../features/admin-preview/PreviewPageHeader';

/** «Группы в CRM» для ментора (свои группы) и тимлида (группы своей команды). */
export function CrmGroupsPage(): JSX.Element {
  const { user } = useAuth();
  const isLead = user?.role === 'Lead';

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Группы в CRM"
        subtitle={isLead
          ? 'Группы менторов вашей команды: студенты, посещаемость и баллы по неделям из Omuz CRM'
          : 'Ваши группы: студенты, посещаемость и баллы по неделям из Omuz CRM'}
      />
      <CrmGroupsView />
    </div>
  );
}

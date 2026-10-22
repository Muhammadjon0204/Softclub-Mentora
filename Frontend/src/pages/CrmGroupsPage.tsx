import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { CrmGroupsView } from '../features/admin-crm/CrmGroupsView';
import { CrmReportsView } from '../features/admin-crm/CrmReportsView';
import { CrmSectionTabs } from '../features/admin-crm/CrmSectionTabs';
import { PreviewPageHeader } from '../features/admin-preview/PreviewPageHeader';

const SECTIONS = [
  { value: 'groups', label: 'Группы' },
  { value: 'reports', label: 'Отчёты' },
] as const;

/** «Группы в CRM» для ментора (свои группы и отчёты) и тимлида (группы команды и отчёты менторов). */
export function CrmGroupsPage(): JSX.Element {
  const { user } = useAuth();
  const isLead = user?.role === 'Lead';
  // Ссылка из уведомления «отчёт отправлен» — /lead/crm?report=<id> — сразу открывает отчёт.
  const [params, setParams] = useSearchParams();
  const linkedReport = params.get('report');
  const [section, setSection] = useState<'groups' | 'reports'>(linkedReport ? 'reports' : 'groups');

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Группы в CRM"
        subtitle={isLead
          ? 'Группы менторов вашей команды: студенты, посещаемость и баллы по неделям из Omuz CRM'
          : 'Ваши группы: студенты, посещаемость и баллы по неделям из Omuz CRM'}
      />
      <CrmSectionTabs sections={SECTIONS} value={section} onChange={setSection} />
      {section === 'groups' ? (
        <CrmGroupsView />
      ) : (
        <CrmReportsView
          initialOpenId={linkedReport}
          onClosed={() => { if (linkedReport) setParams({}, { replace: true }); }}
        />
      )}
    </div>
  );
}

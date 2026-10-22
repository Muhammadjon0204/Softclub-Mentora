import { PlugZap } from 'lucide-react';

import { useAuth } from '../../auth/useAuth';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';

/**
 * CRM ещё не подключена: на сервере нет ключа API. Админу организации — что сделать, остальным — что
 * это не их ошибка и ждать включения.
 */
export function CrmNotConfigured(): JSX.Element {
  const { user } = useAuth();
  const isOrgAdmin = user?.role === 'Admin' && user.adminScope === 'Organization';

  return (
    <Card>
      <EmptyState
        icon={<PlugZap className="h-5 w-5" aria-hidden="true" />}
        title="CRM ещё не подключена"
        description={isOrgAdmin
          ? 'На сервере не задан ключ API. Добавьте строку OmuzCrm__ApiKey=<ключ> в .env.api и пересоздайте контейнер API — после этого здесь появятся группы и связи.'
          : 'Интеграцию с CRM ещё не включил администратор организации. Как только её включат, здесь появятся группы.'}
      />
    </Card>
  );
}

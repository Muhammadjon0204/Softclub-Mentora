import { useAuth } from '../auth/useAuth';
import { PreviewPageHeader } from '../features/admin-preview/PreviewPageHeader';
import { ProfileIdentityCard } from '../features/profile/ProfileIdentityCard';
import { ProfileNotificationsCard } from '../features/profile/ProfileNotificationsCard';
import { ProfilePersonalCard } from '../features/profile/ProfilePersonalCard';
import { ProfileSecurityCard } from '../features/profile/ProfileSecurityCard';
import { ProfileTelegramCard } from '../features/profile/ProfileTelegramCard';
import { StaggerContainer, StaggerItem } from '../shared/ui/motion';

/**
 * Профиль — общий для всех ролей. Слева: кто я и Telegram; справа: личные данные, уведомления,
 * безопасность. Всё, что здесь меняется, сохраняется на сервере (кроме цвета аватара — он
 * личный и живёт в этом браузере).
 */
export function ProfilePage(): JSX.Element | null {
  const { user } = useAuth();
  if (user === null) return null;

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Профиль" subtitle="Личные данные, уведомления и безопасность аккаунта" />

      <StaggerContainer className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <StaggerItem><ProfileIdentityCard user={user} /></StaggerItem>
          <StaggerItem><ProfileTelegramCard /></StaggerItem>
        </div>
        <div className="space-y-6 lg:col-span-8">
          <StaggerItem><ProfilePersonalCard user={user} /></StaggerItem>
          <StaggerItem><ProfileNotificationsCard user={user} /></StaggerItem>
          <StaggerItem><ProfileSecurityCard /></StaggerItem>
        </div>
      </StaggerContainer>
    </div>
  );
}

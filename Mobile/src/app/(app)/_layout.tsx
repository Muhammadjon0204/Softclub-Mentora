import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { StateMessage } from '@/ui/primitives';

export default function SignedInLayout(): JSX.Element {
  const { t } = useT();
  const { switching, takeAfterSwitch } = useSession();
  useEffect(() => {
    if (switching) return;
    const href = takeAfterSwitch();
    if (href) router.push(href);
  }, [switching, takeAfterSwitch]);
  // Between two teams every screen is taken down and built again for the new role.
  if (switching) return <StateMessage loading title={t('Загрузка…')} />;
  const title = (text: string) => ({ title: t(text), headerBackTitle: t('Назад') });
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="assignment/[id]" options={title('Задание')} />
      <Stack.Screen name="assignment/new" options={title('Новое задание')} />
      <Stack.Screen name="users/index" options={title('Пользователи')} />
      <Stack.Screen name="users/new" options={title('Новый пользователь')} />
      <Stack.Screen name="users/[id]" options={title('Пользователь')} />
      <Stack.Screen name="categories/index" options={title('Направления')} />
      <Stack.Screen name="categories/[id]" options={title('Направление')} />
      <Stack.Screen name="branches" options={title('Филиалы')} />
      <Stack.Screen name="permissions/index" options={title('Права доступа')} />
      <Stack.Screen name="permissions/[userId]" options={title('Права пользователя')} />
      <Stack.Screen name="proposals/index" options={title('Предложения')} />
      <Stack.Screen name="proposals/[id]" options={title('Предложение')} />
      <Stack.Screen name="proposals/new" options={title('Новое предложение')} />
      <Stack.Screen name="calendar" options={title('Календарь')} />
      <Stack.Screen name="reports" options={title('Отчёты')} />
      <Stack.Screen name="journal" options={title('Журнал заданий')} />
      <Stack.Screen name="audit" options={title('Журнал аудита')} />
      <Stack.Screen name="notifications" options={title('Уведомления')} />
      <Stack.Screen name="health" options={title('Состояние системы')} />
      <Stack.Screen name="crm/index" options={title('Интеграция CRM')} />
      <Stack.Screen name="crm/[id]" options={title('Группа')} />
      <Stack.Screen name="profile" options={title('Профиль')} />
    </Stack>
  );
}

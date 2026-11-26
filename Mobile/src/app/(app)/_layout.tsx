import { Stack } from 'expo-router';

import { useT } from '@/lib/i18n';

export default function SignedInLayout(): JSX.Element {
  const { t } = useT();
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="assignment/[id]" options={{ title: t('Задание'), headerBackTitle: t('Назад') }} />
    </Stack>
  );
}

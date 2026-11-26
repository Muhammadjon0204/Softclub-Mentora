import { NativeTabs } from 'expo-router/native-tabs';

import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

export default function TabsLayout(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  return (
    <NativeTabs backgroundColor={c.surface} tintColor={c.brand}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('Задания')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist' }} md="assignment" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('Профиль')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

import { NativeTabs } from 'expo-router/native-tabs';

import { awaitingMyReview, useAssignments } from '@/features/assignments/queries';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';

export default function TabsLayout(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const assignments = useAssignments();
  const isMentor = user.role === 'Mentor';
  const waiting = awaitingMyReview(assignments.data ?? []).length;

  return (
    <NativeTabs backgroundColor={c.surface} tintColor={c.brand}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('Задания')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist' }} md="assignment" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review" hidden={isMentor}>
        <NativeTabs.Trigger.Label>{t('Проверка')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checkmark.seal', selected: 'checkmark.seal.fill' }} md="fact_check" />
        {waiting > 0 ? <NativeTabs.Trigger.Badge>{String(waiting)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <NativeTabs.Trigger.Label>{t('Журнал')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} md="history" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('Профиль')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

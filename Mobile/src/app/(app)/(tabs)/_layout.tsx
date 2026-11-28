import { NativeTabs } from 'expo-router/native-tabs';

import { awaitingMyReview, useAssignments } from '@/features/assignments/queries';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';

/** Four places a person returns to all day; every other section is one tap away under «Ещё». */
export default function TabsLayout(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const assignments = useAssignments();
  const isMentor = user.role === 'Mentor';
  const waiting = awaitingMyReview(assignments.data ?? []).length;

  return (
    <NativeTabs backgroundColor={c.surface} tintColor={c.brand} indicatorColor={c.brandSoft}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('Обзор')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="dashboard" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assignments">
        <NativeTabs.Trigger.Label>{t('Задания')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist' }} md="assignment" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review" hidden={isMentor}>
        <NativeTabs.Trigger.Label>{t('Проверка')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checkmark.seal', selected: 'checkmark.seal.fill' }} md="fact_check" />
        {waiting > 0 ? <NativeTabs.Trigger.Badge>{String(waiting)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>{t('Ещё')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="menu" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

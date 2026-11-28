import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { PencilLine, Power, PowerOff, Settings2 } from 'lucide-react-native';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import {
  getCategorySettings,
  listCategories,
  setCategoryActive,
  updateCategory,
  updateCategorySettings,
  type Category,
  type CategorySettings,
} from '@/api/categories';
import { listUsers } from '@/api/users';
import { Space } from '@/constants/theme';
import { useAssignments, useCan } from '@/features/assignments/queries';
import { isActionable } from '@/features/assignments/status';
import { teamsOf } from '@/features/teams/labels';
import { TeamSection } from '@/features/teams/TeamSection';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { useAction, useConfirm } from '@/ui/feedback';
import { Button, Chips, Group, Info, Row, Section, Stats } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Field, StateMessage } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';

export default function CategoryScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUser();
  const query = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>
        {(all) => {
          const category = all.find((x) => x.id === id);
          return category ? <Details category={category} /> : <NotFound />;
        }}
      </Loaded>
    </Page>
  );
}

function NotFound(): JSX.Element {
  const { t } = useT();
  return <StateMessage title={t('Направление не найдено')} />;
}

function Details({ category }: { category: Category }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const me = useUser();
  const can = useCan();
  const confirm = useConfirm();
  const users = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const settings = useQuery({ queryKey: ['category-settings', category.id], queryFn: () => getCategorySettings(category.id) });
  const assignments = useAssignments();
  const [panel, setPanel] = useState<'edit' | 'settings' | null>(null);
  const toggle = useAction((active: boolean) => setCategoryActive(category, active, true), { success: 'Сохранено' });
  const manage = me.role === 'Admin' && can('categories.manage');

  const mentors = (users.data ?? []).filter(
    (u) => u.isActive && teamsOf(u).some((team) => team.categoryId === category.id && team.role === 'Mentor'),
  );
  const tasks = (assignments.data ?? []).filter((a) => a.categoryId === category.id);

  return (
    <>
      <Stack.Screen options={{ title: category.name }} />
      <View style={{ gap: Space.xs }}>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>{category.name}</Text>
        {category.description ? <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{category.description}</Text> : null}
        {!category.isActive ? <Text style={{ color: c.danger, fontSize: 14 }}>{t('Направление отключено')}</Text> : null}
      </View>

      <Stats
        items={[
          { label: t('Менторы'), value: mentors.length },
          { label: t('В работе'), value: tasks.filter((a) => isActionable(a.status)).length },
          { label: t('Просрочено'), value: tasks.filter((a) => a.status === 'Overdue').length, tone: 'danger' },
          { label: t('Принято'), value: tasks.filter((a) => a.status === 'Approved').length, tone: 'success' },
        ]}
      />

      <TeamSection categoryId={category.id} branchId={category.branchId} />

      <Section title={t('Настройки сроков')}>
        <Loaded query={settings}>
          {(s) => (
            <Group>
              <Info label={t('Срок по умолчанию')} value={`${s.defaultAssignmentDueDays} ${t('дн.')}, ${s.defaultDueTimeLocal.slice(0, 5)}`} />
              <Info label={t('Напоминание до срока')} value={`${s.deadlineReminderHours} ${t('ч')}`} />
              <Info label={t('Сдача после срока')} value={t(s.allowLateSubmission ? 'Разрешена' : 'Запрещена')} />
              <Info label={t('Часовой пояс')} value={s.timeZoneId} />
            </Group>
          )}
        </Loaded>
      </Section>

      {manage ? (
        <Section title={t('Управление')}>
          <Group>
            <Row title={t('Изменить название и описание')} icon={PencilLine} onPress={() => setPanel('edit')} />
            {settings.data ? <Row title={t('Настроить сроки')} icon={Settings2} onPress={() => setPanel('settings')} /> : null}
            {category.isActive ? (
              <Row
                title={t('Отключить направление')}
                icon={PowerOff}
                iconTone="danger"
                danger
                onPress={() => confirm(t('Отключить направление?'), t('Новые задания в нём выдавать будет нельзя.'), t('Отключить'), () => toggle.run(false), true)}
              />
            ) : (
              <Row title={t('Включить направление')} icon={Power} iconTone="success" onPress={() => toggle.run(true)} />
            )}
          </Group>
        </Section>
      ) : null}

      {panel === 'edit' ? <EditPanel category={category} onClose={() => setPanel(null)} /> : null}
      {panel === 'settings' && settings.data ? <SettingsPanel category={category} settings={settings.data} onClose={() => setPanel(null)} /> : null}
    </>
  );
}

function EditPanel({ category, onClose }: { category: Category; onClose: () => void }): JSX.Element {
  const { t } = useT();
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? '');
  const save = useAction(() => updateCategory(category, name.trim(), description.trim() || null), { success: 'Сохранено', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Изменить направление')}>
      <Field label={t('Название')} value={name} onChangeText={setName} maxLength={100} />
      <Field label={t('Описание')} value={description} onChangeText={setDescription} multiline maxLength={1000} />
      <Button label={t('Сохранить')} onPress={() => save.run()} loading={save.busy} disabled={name.trim().length < 2} />
    </Sheet>
  );
}

function SettingsPanel({ category, settings, onClose }: { category: Category; settings: CategorySettings; onClose: () => void }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const [days, setDays] = useState(String(settings.defaultAssignmentDueDays));
  const [time, setTime] = useState(settings.defaultDueTimeLocal.slice(0, 5));
  const [reminder, setReminder] = useState(String(settings.deadlineReminderHours));
  const [late, setLate] = useState(settings.allowLateSubmission);
  const valid = /^\d{1,3}$/.test(days) && Number(days) >= 1 && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && /^\d{1,3}$/.test(reminder);
  const save = useAction(
    () =>
      updateCategorySettings(
        { ...settings, defaultAssignmentDueDays: Number(days), defaultDueTimeLocal: `${time}:00`, deadlineReminderHours: Number(reminder), allowLateSubmission: late },
        category.branchId,
      ),
    { success: 'Настройки сохранены', onDone: onClose },
  );
  return (
    <Sheet open onClose={onClose} title={t('Настроить сроки')}>
      <Field label={t('Дней на задание по умолчанию')} value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={3} />
      <View style={{ gap: Space.sm }}>
        <Field label={t('Время сдачи (ЧЧ:ММ)')} value={time} onChangeText={setTime} maxLength={5} placeholder="23:59" />
        <Chips value={time} onChange={setTime} inset={false} options={['12:00', '18:00', '23:59'].map((v) => ({ value: v, label: v }))} />
      </View>
      <Field label={t('Напоминать за, часов')} value={reminder} onChangeText={setReminder} keyboardType="number-pad" maxLength={3} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md }}>
        <Text style={{ flex: 1, color: c.text, fontSize: 15 }}>{t('Разрешить сдачу после срока')}</Text>
        <Switch value={late} onValueChange={setLate} trackColor={{ true: c.brand, false: c.border }} thumbColor="#ffffff" accessibilityLabel={t('Разрешить сдачу после срока')} />
      </View>
      <Button label={t('Сохранить')} onPress={() => save.run()} loading={save.busy} disabled={!valid} />
    </Sheet>
  );
}

import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Globe, KeyRound, LogOut, PencilLine, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';

import {
  changePassword,
  createTelegramLink,
  getPreferences,
  getTelegramStatus,
  savePreferences,
  testTelegram,
  unbindTelegram,
  updateName,
  type NotificationPreferences,
} from '@/api/profile';
import { Space } from '@/constants/theme';
import { roleLabel } from '@/features/journal/api';
import { ApiError } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { setLanguage, useT, type Language } from '@/lib/i18n';
import { useSession, useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { useAction, useConfirm, useToast } from '@/ui/feedback';
import { Avatar, Button, Group, Info, Row, Section } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Field } from '@/ui/primitives';
import { Segmented } from '@/ui/Screen';
import { Sheet } from '@/ui/sheet';

const TOPICS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'assignments', label: 'Задания' },
  { key: 'deadlines', label: 'Сроки' },
  { key: 'reviews', label: 'Проверки' },
  { key: 'system', label: 'Системные' },
];

export default function ProfileScreen(): JSX.Element {
  const c = useColors();
  const { t, language } = useT();
  const user = useUser();
  const { signOut } = useSession();
  const confirm = useConfirm();
  const [panel, setPanel] = useState<'name' | 'password' | null>(null);

  return (
    <Page>
      <View style={{ alignItems: 'center', gap: Space.xs }}>
        <Avatar name={user.fullName} size={72} />
        <Text style={{ color: c.text, fontSize: 21, fontWeight: '700', textAlign: 'center' }}>{user.fullName}</Text>
        <Text style={{ color: c.textMuted, fontSize: 14 }}>{user.email}</Text>
      </View>

      <Group>
        <Info label={t('Роль')} value={t(roleLabel(user))} />
        {user.branch ? <Info label={t('Филиал')} value={user.branch.name} /> : null}
        {user.category ? <Info label={t('Направление')} value={user.category.name} /> : null}
      </Group>

      <Group>
        <Row title={t('Изменить имя')} icon={PencilLine} onPress={() => setPanel('name')} />
        <Row title={t('Сменить пароль')} icon={KeyRound} onPress={() => setPanel('password')} />
      </Group>

      <Telegram />
      <Preferences />

      <Section title={t('Язык')}>
        <Segmented
          value={language}
          onChange={(value: Language) => setLanguage(value)}
          options={[
            { value: 'ru', label: 'Русский' },
            { value: 'tg', label: 'Тоҷикӣ' },
            { value: 'en', label: 'English' },
          ]}
        />
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('Тема оформления следует настройкам телефона.')}</Text>
      </Section>

      <Group>
        <Row title={t('Открыть сайт RAVAND')} icon={Globe} onPress={() => void WebBrowser.openBrowserAsync(WEB_URL)} />
        <Row
          title={t('Выйти')}
          icon={LogOut}
          iconTone="danger"
          danger
          onPress={() => confirm(t('Выйти из аккаунта?'), t('На этом телефоне нужно будет снова ввести пароль.'), t('Выйти'), () => void signOut(), true)}
        />
      </Group>

      {panel === 'name' ? <NamePanel onClose={() => setPanel(null)} /> : null}
      {panel === 'password' ? <PasswordPanel onClose={() => setPanel(null)} /> : null}
    </Page>
  );
}

function NamePanel({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useT();
  const user = useUser();
  const { setUser } = useSession();
  const [name, setName] = useState(user.fullName);
  const save = useAction(async () => setUser(await updateName(name.trim())), { success: 'Сохранено', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Изменить имя')}>
      <Field label={t('Имя и фамилия')} value={name} onChangeText={setName} maxLength={200} autoCapitalize="words" />
      <Button label={t('Сохранить')} onPress={() => save.run()} loading={save.busy} disabled={name.trim().length < 2} />
    </Sheet>
  );
}

function PasswordPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useT();
  const user = useUser();
  const { signIn } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const save = useAction(
    async () => {
      await changePassword(current, next);
      // Changing the password ends old sessions, this phone's included — sign in again at once.
      await signIn(user.email, next);
    },
    { success: 'Пароль изменён', onDone: onClose },
  );
  return (
    <Sheet open onClose={onClose} title={t('Сменить пароль')}>
      <Field label={t('Текущий пароль')} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
      <Field label={t('Новый пароль')} value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" maxLength={8} placeholder={t('От 5 до 8 символов')} />
      <Button label={t('Сменить пароль')} onPress={() => save.run()} loading={save.busy} disabled={!current || next.length < 5} />
    </Sheet>
  );
}

function Telegram(): JSX.Element | null {
  const { t } = useT();
  const user = useUser();
  const toast = useToast();
  const confirm = useConfirm();
  const query = useQuery({ queryKey: ['telegram', user.id], queryFn: getTelegramStatus, retry: false });
  const connect = useAction(async () => {
    const { deepLink } = await createTelegramLink();
    await Linking.openURL(deepLink);
  });
  const test = useAction(async () => {
    const result = await testTelegram();
    toast(result.delivered ? t('Сообщение отправлено') : (result.error ?? t('Не удалось отправить')), !result.delivered);
  });
  const unbind = useAction(() => unbindTelegram(), { success: 'Telegram отключён' });
  // A server without a bot answers 404: there is nothing to connect, so nothing to show.
  if (query.error instanceof ApiError && query.error.status === 404) return null;
  return (
    <Section title="Telegram">
      <Loaded query={query}>
        {(status) => (
          <Group>
            {status.isBound ? (
              <>
                <Row title={t('Telegram подключён')} subtitle={t('Нажмите, чтобы отправить проверочное сообщение')} icon={Send} iconTone="success" onPress={() => test.run()} />
                <Row title={t('Отключить Telegram')} danger onPress={() => confirm(t('Отключить Telegram?'), t('Уведомления перестанут приходить в Telegram.'), t('Отключить'), () => unbind.run(), true)} />
              </>
            ) : (
              <Row title={t('Подключить Telegram')} subtitle={t('Откроется бот: нажмите в нём «Start», затем вернитесь сюда и потяните экран')} icon={Send} iconTone="brand" onPress={() => connect.run()} />
            )}
          </Group>
        )}
      </Loaded>
    </Section>
  );
}

function Preferences(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const query = useQuery({ queryKey: ['preferences', user.id], queryFn: getPreferences });
  const save = useAction((next: NotificationPreferences) => savePreferences(next));
  const toggle = (p: NotificationPreferences, key: keyof NotificationPreferences, channel: 'email' | 'telegram', value: boolean) =>
    save.run({ ...p, [key]: { ...p[key], [channel]: value } });
  return (
    <Section title={t('Уведомления')}>
      <Loaded query={query}>
        {(p) => (
          <Group>
            <View style={styles.pref}>
              <Text style={{ flex: 1 }} />
              <Text style={[styles.channel, { color: c.textMuted }]}>Email</Text>
              <Text style={[styles.channel, { color: c.textMuted }]}>Telegram</Text>
            </View>
            {TOPICS.map((topic) => (
              <View key={topic.key} style={styles.pref}>
                <Text style={{ flex: 1, color: c.text, fontSize: 15 }}>{t(topic.label)}</Text>
                {(['email', 'telegram'] as const).map((channel) => (
                  <View key={channel} style={styles.channelBox}>
                    <Switch
                      value={p[topic.key][channel]}
                      disabled={save.busy}
                      onValueChange={(value) => toggle(p, topic.key, channel, value)}
                      trackColor={{ true: c.brand, false: c.border }}
                      thumbColor="#ffffff"
                      accessibilityLabel={`${t(topic.label)}, ${channel}`}
                    />
                  </View>
                ))}
              </View>
            ))}
          </Group>
        )}
      </Loaded>
    </Section>
  );
}

const styles = StyleSheet.create({
  pref: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.md + 2, paddingVertical: Space.sm, minHeight: 48 },
  channel: { width: 68, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  channelBox: { width: 68, alignItems: 'center' },
});

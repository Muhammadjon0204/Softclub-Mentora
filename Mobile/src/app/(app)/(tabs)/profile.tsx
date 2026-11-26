import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Space } from '@/constants/theme';
import { roleLabel } from '@/features/journal/api';
import { WEB_URL } from '@/lib/config';
import { setLanguage, useT, type Language } from '@/lib/i18n';
import { useSession, useUser } from '@/lib/session';
import { useColors, WEB_TAB_BAR_INSET } from '@/lib/useColors';
import { SecondaryButton } from '@/ui/primitives';

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'tg', label: 'Тоҷикӣ' },
  { value: 'en', label: 'English' },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen(): JSX.Element {
  const c = useColors();
  const { t, language } = useT();
  const user = useUser();
  const { signOut } = useSession();

  function confirmSignOut(): void {
    if (Platform.OS === 'web') {
      void signOut();
      return;
    }
    Alert.alert(t('Выйти из аккаунта?'), t('На этом телефоне нужно будет снова ввести пароль.'), [
      { text: t('Отмена'), style: 'cancel' },
      { text: t('Выйти'), style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background, paddingTop: WEB_TAB_BAR_INSET }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{t('Профиль')}</Text>

        <View style={styles.person}>
          <View style={[styles.avatar, { backgroundColor: c.brandSoft }]}>
            <Text style={{ color: c.brand, fontSize: 20, fontWeight: '700' }}>{initials(user.fullName)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{user.fullName}</Text>
            <Text style={{ color: c.textMuted, fontSize: 14 }}>{user.email}</Text>
          </View>
        </View>

        <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
          <InfoRow label={t('Роль')} value={t(roleLabel(user))} last={!user.branch && !user.category} />
          {user.branch ? <InfoRow label={t('Филиал')} value={user.branch.name} last={!user.category} /> : null}
          {user.category ? <InfoRow label={t('Направление')} value={user.category.name} last /> : null}
        </View>

        <View style={{ gap: Space.sm }}>
          <Text style={[styles.groupTitle, { color: c.textSecondary }]}>{t('Язык')}</Text>
          <View style={[styles.segment, { backgroundColor: c.surfaceMuted }]} accessibilityRole="radiogroup">
            {LANGUAGES.map((l) => {
              const selected = l.value === language;
              return (
                <Pressable
                  key={l.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setLanguage(l.value)}
                  style={[styles.segmentItem, selected && { backgroundColor: c.surface }]}
                >
                  <Text style={{ color: selected ? c.text : c.textMuted, fontWeight: selected ? '600' : '500', fontSize: 14 }}>{l.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('Тема оформления следует настройкам телефона.')}</Text>
        </View>

        <View style={{ gap: Space.sm }}>
          <SecondaryButton label={t('Открыть сайт RAVAND')} onPress={() => void WebBrowser.openBrowserAsync(WEB_URL)} />
          <SecondaryButton label={t('Выйти')} tone="danger" onPress={confirmSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }): JSX.Element {
  const c = useColors();
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }]}>
      <Text style={{ color: c.textMuted, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '500', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Space.lg, gap: Space.xl, paddingBottom: Space.xxl },
  title: { fontSize: 30, fontWeight: '700' },
  person: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  group: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Space.lg },
  groupTitle: { fontSize: 13, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Space.lg, paddingVertical: Space.md },
  segment: { flexDirection: 'row', borderRadius: Radius.md, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: Space.sm, borderRadius: Radius.sm },
});

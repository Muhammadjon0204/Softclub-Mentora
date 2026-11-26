import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Space } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Field, PrimaryButton } from '@/ui/primitives';

export default function SignInScreen(): JSX.Element {
  const c = useColors();
  const scheme = useColorScheme();
  const { t } = useT();
  const { state, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notice = state.status === 'signedOut' ? state.notice : null;
  const canSubmit = email.trim().length > 3 && password.length > 0;

  async function submit(): Promise<void> {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_CREDENTIALS') setError(t('Неверный email или пароль.'));
      else if (e instanceof ApiError && e.code === 'RATE_LIMIT_EXCEEDED') setError(t('Слишком много попыток. Подождите минуту.'));
      else setError(e instanceof Error ? t(e.message) : t('Не удалось войти. Попробуйте ещё раз.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Image
            source={scheme === 'dark' ? require('@/assets/brand/logo-dark.png') : require('@/assets/brand/logo-light.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="RAVAND"
          />
          <View style={{ gap: Space.xs }}>
            <Text style={[styles.title, { color: c.text }]}>{t('Вход для ментора')}</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>{t('Тот же email и пароль, что на сайте RAVAND.')}</Text>
          </View>

          {(error ?? notice) ? (
            <View style={[styles.alert, { backgroundColor: c.dangerSoft }]} accessibilityLiveRegion="polite">
              <Text style={{ color: c.danger, fontSize: 14, lineHeight: 20 }}>{error ?? t(notice ?? '')}</Text>
            </View>
          ) : null}

          <View style={{ gap: Space.lg }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="name@company.com"
              returnKeyType="next"
            />
            <Field
              label={t('Пароль')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
          </View>

          <PrimaryButton label={t('Войти')} onPress={() => void submit()} loading={busy} disabled={!canSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: Space.xl, gap: Space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { width: 168, height: 40 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 21 },
  alert: { borderRadius: 10, padding: Space.md },
});

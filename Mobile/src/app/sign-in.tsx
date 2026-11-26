import { Image } from 'expo-image';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Space } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';
import { Field, PrimaryButton } from '@/ui/primitives';

export default function SignInScreen(): JSX.Element {
  const c = useColors();
  const scheme = useColorScheme();
  const { t } = useT();
  const { state, signIn } = useSession();
  const keyboard = useKeyboardVisible();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeSeen, setNoticeSeen] = useState(false);

  const notice = state.status === 'signedOut' && !noticeSeen ? state.notice : null;
  const message = error ?? (notice ? t(notice) : null);
  const canSubmit = email.trim().length > 3 && password.length > 0;

  /** A message about the last attempt must not sit over what is being typed now. */
  function typed(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setError(null);
      setNoticeSeen(true);
    };
  }

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
      {/* Android windows do not resize for the keyboard any more (edge-to-edge), so both platforms pad. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={[styles.container, keyboard && styles.containerWithKeyboard]}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={scheme === 'dark' ? require('@/assets/brand/logo-dark.png') : require('@/assets/brand/logo-light.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="RAVAND"
          />
          <View style={{ gap: Space.xs }}>
            <Text style={[styles.title, { color: c.text }]}>{t('Вход в RAVAND')}</Text>
            {!keyboard ? (
              <Text style={[styles.subtitle, { color: c.textMuted }]}>{t('Тот же email и пароль, что на сайте RAVAND.')}</Text>
            ) : null}
          </View>

          {message ? (
            <View style={[styles.alert, { backgroundColor: c.dangerSoft }]} accessibilityLiveRegion="polite">
              <Text style={{ color: c.danger, fontSize: 14, lineHeight: 20 }}>{message}</Text>
            </View>
          ) : null}

          <View style={{ gap: Space.lg }}>
            <Field
              label="Email"
              value={email}
              onChangeText={typed(setEmail)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="name@company.com"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              label={t('Пароль')}
              inputRef={passwordRef}
              value={password}
              onChangeText={typed(setPassword)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  style={styles.reveal}
                >
                  <Text style={{ color: c.brand, fontSize: 14, fontWeight: '600' }}>{showPassword ? t('Скрыть') : t('Показать')}</Text>
                </Pressable>
              }
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
  // With the keyboard up the form starts at the top, so both fields and the button stay on screen.
  containerWithKeyboard: { justifyContent: 'flex-start', paddingVertical: Space.md, gap: Space.lg },
  logo: { width: 168, height: 40 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 21 },
  alert: { borderRadius: 10, padding: Space.md },
  reveal: { paddingHorizontal: Space.md, minHeight: 48, justifyContent: 'center' },
});

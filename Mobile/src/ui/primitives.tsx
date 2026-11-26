import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { STATUS_LABEL, STATUS_TONE, toneColors } from '@/features/assignments/status';
import type { AssignmentStatus } from '@/features/assignments/api';

export function PrimaryButton({ label, onPress, loading = false, disabled = false }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}): JSX.Element {
  const c = useColors();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: c.brand, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={c.onBrand} /> : <Text style={[styles.buttonText, { color: c.onBrand }]}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, tone = 'neutral' }: { label: string; onPress: () => void; tone?: 'neutral' | 'danger' }): JSX.Element {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: tone === 'danger' ? c.danger : c.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }): JSX.Element {
  const c = useColors();
  return (
    <View style={{ gap: Space.xs + 2 }}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        {...input}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: error ? c.danger : c.border }]}
      />
    </View>
  );
}

export function StatusPill({ status }: { status: AssignmentStatus }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const { fg, bg } = toneColors(STATUS_TONE[status], c);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{t(STATUS_LABEL[status])}</Text>
    </View>
  );
}

/** Loading, error and empty states share one quiet layout: a line of text and, when useful, an action. */
export function StateMessage({ title, detail, action, loading = false }: {
  title: string;
  detail?: string;
  action?: ReactNode;
  loading?: boolean;
}): JSX.Element {
  const c = useColors();
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator color={c.brand} /> : null}
      <Text style={[styles.stateTitle, { color: c.text }]}>{title}</Text>
      {detail ? <Text style={[styles.stateDetail, { color: c.textMuted }]}>{detail}</Text> : null}
      {action ? <View style={{ marginTop: Space.md, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.lg },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '500' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.md, fontSize: 16 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: Space.sm, paddingVertical: 2 },
  pillText: { fontSize: 12, fontWeight: '600' },
  state: { alignItems: 'center', justifyContent: 'center', gap: Space.sm, padding: Space.xl, paddingTop: Space.xxl * 2 },
  stateTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  stateDetail: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

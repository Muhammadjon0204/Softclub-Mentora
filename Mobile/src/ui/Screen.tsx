import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Space } from '@/constants/theme';
import { useColors, WEB_TAB_BAR_INSET } from '@/lib/useColors';

/** A tab screen: large title, one line under it, then the content. */
export function Screen({ title, subtitle, header, children }: {
  title: string;
  subtitle?: string | null;
  header?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const c = useColors();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background, paddingTop: WEB_TAB_BAR_INSET }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text> : null}
        {header}
      </View>
      {children}
    </SafeAreaView>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}): JSX.Element {
  const c = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: c.surfaceMuted }]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segmentItem, selected && { backgroundColor: c.surface }]}
          >
            <Text style={{ color: selected ? c.text : c.textMuted, fontWeight: selected ? '600' : '500', fontSize: 14 }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: Space.sm },
  title: { fontSize: 30, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  segment: { flexDirection: 'row', borderRadius: Radius.md, padding: 3, marginTop: Space.md },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: Space.sm, borderRadius: Radius.sm },
});

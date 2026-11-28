import { Check, ChevronRight, Search, X, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { toneColors, type Tone } from '@/features/assignments/status';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

/** The app's shared building blocks. One look for every screen: white blocks on a quiet background,
 *  a title above each block, rows that lead somewhere end in a chevron. */

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }): JSX.Element {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function Section({ title, action, onAction, children }: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}): JSX.Element {
  const c = useColors();
  return (
    <View style={{ gap: Space.sm }}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]} accessibilityRole="header">{title}</Text>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
            <Text style={{ color: c.brand, fontSize: 14, fontWeight: '600' }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Rows stacked in one card, separated by hairlines. */
export function Group({ children }: { children: ReactNode }): JSX.Element {
  const c = useColors();
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider } : null}>
          {row}
        </View>
      ))}
    </View>
  );
}

export function Row({ title, subtitle, meta, icon: Icon, iconTone = 'neutral', leading, trailing, onPress, danger, selected }: {
  title: string;
  subtitle?: string | null;
  meta?: ReactNode;
  icon?: LucideIcon;
  iconTone?: Tone;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  /** Makes the row one choice of several: a tick when chosen, no chevron. */
  selected?: boolean;
}): JSX.Element {
  const c = useColors();
  const choice = selected !== undefined;
  const tone = toneColors(iconTone, c);
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={choice ? 'radio' : onPress ? 'button' : undefined}
      accessibilityState={choice ? { selected } : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceMuted }]}
    >
      {leading}
      {Icon ? (
        <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
          <Icon size={18} color={tone.fg} />
        </View>
      ) : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: danger ? c.danger : c.text }]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 18 }} numberOfLines={3}>{subtitle}</Text> : null}
        {meta}
      </View>
      {trailing}
      {choice ? <Check size={18} color={selected ? c.brand : 'transparent'} /> : onPress ? <ChevronRight size={18} color={c.textMuted} /> : null}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }): JSX.Element {
  const c = useColors();
  const { fg, bg } = toneColors(tone, c);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }): JSX.Element {
  const c = useColors();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.brand, fontSize: size * 0.36, fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  );
}

/** Two numbers per line; a tile that leads somewhere is pressable. */
export function Stats({ items }: {
  items: { label: string; value: string | number; hint?: string; tone?: Tone; icon?: LucideIcon; onPress?: () => void }[];
}): JSX.Element {
  const c = useColors();
  return (
    <View style={styles.stats}>
      {items.map((item) => {
        const tone = toneColors(item.tone ?? 'neutral', c);
        const Icon = item.icon;
        return (
          <Pressable
            key={item.label}
            disabled={!item.onPress}
            onPress={item.onPress}
            accessibilityRole={item.onPress ? 'button' : undefined}
            accessibilityLabel={`${item.label}: ${item.value}`}
            style={({ pressed }) => [styles.stat, { backgroundColor: pressed ? c.surfaceMuted : c.surface, borderColor: c.border }]}
          >
            <View style={styles.statHead}>
              <Text style={{ flex: 1, color: c.textMuted, fontSize: 13, lineHeight: 17 }} numberOfLines={2}>{item.label}</Text>
              {Icon ? <Icon size={16} color={tone.fg} /> : null}
            </View>
            <Text style={[styles.statValue, { color: item.tone && item.tone !== 'neutral' && item.value !== 0 ? tone.fg : c.text }]}>{item.value}</Text>
            {item.hint ? <Text style={{ color: c.textMuted, fontSize: 12 }}>{item.hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Progress({ percent, tone = 'brand' }: { percent: number; tone?: Tone }): JSX.Element {
  const c = useColors();
  const value = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.track, { backgroundColor: c.surfaceMuted }]} accessibilityLabel={`${value}%`}>
      <View style={{ width: `${value}%`, height: '100%', borderRadius: 999, backgroundColor: toneColors(tone, c).fg }} />
    </View>
  );
}

export function healthTone(percent: number): Tone {
  return percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'danger';
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  return (
    <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Search size={18} color={c.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1, minHeight: 44, color: c.text, fontSize: 15 }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Очистить')}>
          <X size={18} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chips<T extends string>({ value, options, onChange, inset = true, wrap = false }: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  /** Whether the row bleeds to the screen edges (inside a padded container). */
  inset?: boolean;
  /** Show every option at once, on several lines, instead of a row to scroll. */
  wrap?: boolean;
}): JSX.Element {
  const c = useColors();
  const chips = options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, { borderColor: active ? c.brand : c.border, backgroundColor: active ? c.brandSoft : c.surface }]}
          >
            <Text style={{ color: active ? c.brand : c.textSecondary, fontSize: 13, fontWeight: '600' }}>
              {option.label}
              {option.count !== undefined ? `  ${option.count}` : ''}
            </Text>
          </Pressable>
        );
  });
  if (wrap) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>{chips}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, inset && { marginHorizontal: -Space.lg }]}
      contentContainerStyle={{ gap: Space.sm, paddingHorizontal: inset ? Space.lg : 0 }}
    >
      {chips}
    </ScrollView>
  );
}

/** Label and value, for the details of one thing. */
export function Info({ label, value }: { label: string; value: string }): JSX.Element {
  const c = useColors();
  return (
    <View style={styles.info}>
      <Text style={{ color: c.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '500', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function Button({ label, onPress, kind = 'primary', icon: Icon, loading, disabled, compact }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}): JSX.Element {
  const c = useColors();
  const inactive = disabled || loading;
  const background = kind === 'primary' ? c.brand : c.surface;
  const color = kind === 'primary' ? c.onBrand : kind === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: background, opacity: inactive ? 0.55 : pressed ? 0.8 : 1 },
        kind !== 'primary' && { borderWidth: 1, borderColor: c.border },
      ]}
    >
      {Icon ? <Icon size={18} color={color} /> : null}
      <Text style={{ color, fontSize: compact ? 14 : 16, fontWeight: '600' }}>{loading ? '…' : label}</Text>
    </Pressable>
  );
}

/** The floating «create» button of a list. */
export function Fab({ label, icon: Icon, onPress }: { label: string; icon: LucideIcon; onPress: () => void }): JSX.Element {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.fab, { backgroundColor: c.brand, opacity: pressed ? 0.85 : 1 }]}
    >
      <Icon size={20} color={c.onBrand} />
      <Text style={{ color: c.onBrand, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Space.lg, gap: Space.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Space.md },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  group: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.md + 2, paddingVertical: Space.md, minHeight: 56 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  iconBox: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: Space.sm, paddingVertical: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  stat: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: Radius.lg, padding: Space.md, gap: Space.xs },
  statHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm, minHeight: 34 },
  statValue: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  search: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.md },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Space.md, minHeight: 36, justifyContent: 'center' },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: Space.lg, paddingHorizontal: Space.md + 2, paddingVertical: Space.md },
  button: { flexDirection: 'row', gap: Space.sm, minHeight: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.lg },
  buttonCompact: { minHeight: 40, paddingHorizontal: Space.md },
  fab: { position: 'absolute', right: Space.lg, bottom: Space.lg, flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderRadius: 999, paddingHorizontal: Space.lg + 2, minHeight: 52, elevation: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});

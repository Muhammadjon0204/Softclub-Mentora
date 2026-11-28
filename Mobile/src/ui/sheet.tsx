import { Check, ChevronDown, X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

import { SearchBar } from './kit';

/** A panel from the bottom for one task: pick something, or fill a short form. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Закрыть')} />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: insets.bottom + Space.md, marginTop: insets.top + Space.xl }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Закрыть')}>
              <X size={22} color={c.textMuted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Space.lg, paddingBottom: Space.sm }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface Option<T> {
  value: T;
  label: string;
  hint?: string | null;
}

/** A form field that opens a list; long lists get a search box. */
export function Select<T extends string>({ label, value, options, onChange, placeholder, disabled }: {
  label: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(needle)) : options;
  }, [options, search]);

  return (
    <View style={{ gap: Space.xs + 2 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => {
          setSearch('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder ?? ''}`}
        style={[styles.field, { backgroundColor: c.surface, borderColor: c.border, opacity: disabled ? 0.55 : 1 }]}
      >
        <Text style={{ flex: 1, color: selected ? c.text : c.textMuted, fontSize: 16 }} numberOfLines={1}>
          {selected?.label ?? placeholder ?? t('Выберите')}
        </Text>
        <ChevronDown size={18} color={c.textMuted} />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        {options.length > 7 ? <SearchBar value={search} onChange={setSearch} placeholder={t('Поиск')} /> : null}
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
          {shown.length === 0 ? <Text style={{ color: c.textMuted, padding: Space.lg }}>{t('Ничего не найдено')}</Text> : null}
          {shown.map((option, index) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.value === value }}
              style={[styles.option, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}>{option.label}</Text>
                {option.hint ? <Text style={{ color: c.textMuted, fontSize: 13 }}>{option.hint}</Text> : null}
              </View>
              {option.value === value ? <Check size={18} color={c.brand} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3, 10, 28, 0.55)' },
  backdrop: { flex: 1, minHeight: 40 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: Space.lg, paddingTop: Space.lg, gap: Space.md, flexShrink: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
  title: { flex: 1, fontSize: 19, fontWeight: '700' },
  field: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.md },
  list: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: Space.md, minHeight: 52 },
});

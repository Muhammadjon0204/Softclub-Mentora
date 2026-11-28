import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

import { Button, Chips } from './kit';
import { Sheet } from './sheet';

export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** «Ноябрь 2026» — only the month is capitalised, and without the Russian «г.». */
function monthTitle(month: Date, locale: string): string {
  const name = month.toLocaleDateString(locale, { month: 'long' });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.getFullYear()}`;
}

/** A month, Monday first. `marks` puts dots under days; used by the calendar and the date picker. */
export function MonthGrid({ month, onMonth, selected, onSelect, marks, disablePast }: {
  month: Date;
  onMonth: (next: Date) => void;
  selected: Date | null;
  onSelect: (day: Date) => void;
  marks?: Map<string, 'danger' | 'brand' | 'muted'>;
  disablePast?: boolean;
}): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const todayKey = dayKey(new Date());
  const step = (by: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const weekdays = days.slice(0, 7).map((d) => d.toLocaleDateString(locale, { weekday: 'short' }));

  return (
    <View style={{ gap: Space.sm }}>
      <View style={styles.monthHead}>
        <Pressable onPress={() => step(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Предыдущий месяц')} style={styles.arrow}>
          <ChevronLeft size={22} color={c.textSecondary} />
        </Pressable>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{monthTitle(month, locale)}</Text>
        <Pressable onPress={() => step(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Следующий месяц')} style={styles.arrow}>
          <ChevronRight size={22} color={c.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdays.map((name, i) => (
          <Text key={i} style={[styles.weekday, { color: c.textMuted }]}>{name}</Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, w) => (
        <View key={w} style={styles.week}>
          {days.slice(w * 7, w * 7 + 7).map((day) => {
            const key = dayKey(day);
            const outside = day.getMonth() !== month.getMonth();
            const past = disablePast === true && key < todayKey;
            const active = selected !== null && dayKey(selected) === key;
            const mark = marks?.get(key);
            return (
              <Pressable
                key={key}
                disabled={past}
                onPress={() => onSelect(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: past }}
                accessibilityLabel={day.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                style={styles.cell}
              >
                <View style={[styles.day, active && { backgroundColor: c.brand }, !active && key === todayKey && { borderWidth: 1, borderColor: c.brand }]}>
                  <Text style={{ fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: active || key === todayKey ? '700' : '500', color: active ? c.onBrand : past || outside ? c.textMuted : c.text, opacity: past || outside ? 0.5 : 1 }}>
                    {day.getDate()}
                  </Text>
                </View>
                <View style={[styles.dot, mark ? { backgroundColor: mark === 'danger' ? c.danger : mark === 'brand' ? c.brand : c.textMuted } : null]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const TIMES = ['09:00', '12:00', '15:00', '18:00', '21:00', '23:59'] as const;

/** Date and time of a deadline: a month to tap and the usual hours. */
export function DateTimeField({ label, value, onChange }: { label: string; value: Date | null; onChange: (value: Date) => void }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ?? new Date());
  const [day, setDay] = useState<Date | null>(value);
  const [time, setTime] = useState(() =>
    value ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` : '23:59',
  );
  const times: string[] = (TIMES as readonly string[]).includes(time) ? [...TIMES] : [time, ...TIMES].sort();

  function done(): void {
    if (!day) return;
    const [h, m] = time.split(':').map(Number);
    onChange(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m));
    setOpen(false);
  }

  return (
    <View style={{ gap: Space.xs + 2 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <Pressable
        onPress={() => {
          setMonth(value ?? new Date());
          setDay(value);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.field, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <CalendarDays size={18} color={c.textMuted} />
        <Text style={{ color: value ? c.text : c.textMuted, fontSize: 16 }}>
          {value ? value.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : t('Выберите дату')}
        </Text>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <MonthGrid month={month} onMonth={setMonth} selected={day} onSelect={setDay} disablePast />
        <View style={{ gap: Space.sm }}>
          <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '500' }}>{t('Время')}</Text>
          <Chips wrap value={time} onChange={setTime} options={times.map((v) => ({ value: v, label: v }))} />
        </View>
        <Button label={t('Готово')} onPress={done} disabled={!day} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { padding: Space.sm },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, textTransform: 'capitalize' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, gap: 2 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  field: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.md },
});

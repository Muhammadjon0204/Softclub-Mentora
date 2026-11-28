import { StyleSheet, Text, View } from 'react-native';

import { Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

export interface ActivityPoint {
  label: string;
  submitted: number;
  approved: number;
  overdue: number;
}

const HEIGHT = 96;

/** Three bars per period: handed in, accepted, overdue. The last points only — a phone is narrow. */
export function ActivityChart({ points }: { points: ActivityPoint[] }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const shown = points.slice(-7);
  const max = Math.max(1, ...shown.flatMap((p) => [p.submitted, p.approved, p.overdue]));
  const series = [
    { key: 'submitted', label: 'Отправлено', color: c.brand },
    { key: 'approved', label: 'Одобрено', color: c.success },
    { key: 'overdue', label: 'Просрочено', color: c.danger },
  ] as const;
  const empty = shown.every((p) => p.submitted + p.approved + p.overdue === 0);

  return (
    <View style={{ gap: Space.md }}>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>
              {t(s.label)} {shown.reduce((sum, p) => sum + p[s.key], 0)}
            </Text>
          </View>
        ))}
      </View>
      {empty ? (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('За этот период действий не было')}</Text>
      ) : (
        <View style={styles.chart}>
          {shown.map((p, index) => (
            <View
              key={`${p.label}-${index}`}
              style={styles.column}
              accessibilityLabel={`${p.label}: ${p.submitted}, ${p.approved}, ${p.overdue}`}
            >
              <View style={[styles.bars, { borderBottomColor: c.border }]}>
                {series.map((s) => (
                  <View key={s.key} style={{ width: 7, height: Math.round((p[s.key] / max) * HEIGHT), borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: s.color }} />
                ))}
              </View>
              <Text style={{ color: c.textMuted, fontSize: 10 }} numberOfLines={1}>{p.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Space.xs + 2 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  chart: { flexDirection: 'row', gap: Space.xs },
  column: { flex: 1, alignItems: 'center', gap: Space.xs },
  bars: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, alignSelf: 'stretch', justifyContent: 'center' },
});

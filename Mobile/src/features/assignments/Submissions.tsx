import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

import { getDownloadUrl, type Submission } from './api';

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Handed-in versions, newest first. A file opens in the browser through a short-lived link. */
export function Submissions({ items }: { items: Submission[] }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const [opening, setOpening] = useState<string | null>(null);

  async function open(id: string): Promise<void> {
    setOpening(id);
    try {
      const { url } = await getDownloadUrl(id);
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(t('Не удалось открыть файл'), error instanceof Error ? t(error.message) : undefined);
    } finally {
      setOpening(null);
    }
  }

  return (
    <View style={{ gap: Space.sm }}>
      {[...items]
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .map((s) => (
          <View key={s.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.top}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                {t('Версия')} {s.versionNumber}
              </Text>
              <Text style={{ color: s.isLate ? c.warning : c.textMuted, fontSize: 13 }}>
                {new Date(s.submittedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {s.isLate ? ` · ${t('с опозданием')}` : ''}
              </Text>
            </View>
            {s.comment ? <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 20 }}>{s.comment}</Text> : null}
            {s.originalFileName ? (
              <Pressable
                accessibilityRole="button"
                disabled={opening !== null}
                onPress={() => void open(s.id)}
                style={({ pressed }) => [styles.file, { backgroundColor: c.surfaceMuted, opacity: pressed || opening === s.id ? 0.6 : 1 }]}
              >
                <Text style={{ flex: 1, color: c.text, fontSize: 14 }} numberOfLines={1}>
                  {s.originalFileName}
                  {s.fileSizeBytes ? ` · ${fileSize(s.fileSizeBytes)}` : ''}
                </Text>
                <Text style={{ color: c.brand, fontSize: 14, fontWeight: '600' }}>{opening === s.id ? t('Открываем…') : t('Открыть')}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Space.md, gap: Space.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Space.sm, flexWrap: 'wrap' },
  file: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderRadius: Radius.md, padding: Space.md, minHeight: 44 },
});

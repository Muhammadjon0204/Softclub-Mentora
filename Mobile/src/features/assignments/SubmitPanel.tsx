import * as DocumentPicker from 'expo-document-picker';
import { FileUp, Paperclip, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { submitWork } from '@/api/assignments';
import { Radius, Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { useAction } from '@/ui/feedback';
import { Button, Card } from '@/ui/kit';
import { Field } from '@/ui/primitives';

/** The executor hands in the work: a file, a comment, or both. */
export function SubmitPanel({ assignmentId }: { assignmentId: string }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [comment, setComment] = useState('');
  const send = useAction(() => submitWork(assignmentId, file, comment), {
    success: 'Работа отправлена на проверку',
    onDone: () => {
      setFile(null);
      setComment('');
    },
  });

  async function pick(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled) setFile(result.assets[0] ?? null);
  }

  return (
    <Card style={{ gap: Space.md }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{t('Сдать работу')}</Text>
      {file ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, backgroundColor: c.surfaceMuted, borderRadius: Radius.md, padding: Space.md }}>
          <Paperclip size={18} color={c.textSecondary} />
          <Text style={{ flex: 1, color: c.text }} numberOfLines={1}>{file.name}</Text>
          <Pressable onPress={() => setFile(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Убрать файл')}>
            <X size={18} color={c.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Button kind="secondary" icon={FileUp} label={t('Выбрать файл')} onPress={() => void pick()} />
      )}
      <Field label={t('Комментарий')} value={comment} onChangeText={setComment} multiline maxLength={2000} placeholder={t('Что сделано')} />
      <Button label={t('Отправить на проверку')} onPress={() => send.run()} loading={send.busy} disabled={!file && comment.trim().length === 0} />
    </Card>
  );
}

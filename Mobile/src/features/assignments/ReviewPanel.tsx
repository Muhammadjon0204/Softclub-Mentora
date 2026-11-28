import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Field, PrimaryButton, SecondaryButton } from '@/ui/primitives';

import { decideReview, type Assignment, type ReviewDecision } from './api';

/** The server's own limits for a «rework» comment (`Review.CommentMinLength`/`MaxLength`). */
const COMMENT_MIN = 10;
const COMMENT_MAX = 3000;
const DAY = 24 * 60 * 60 * 1000;
const SHIFTS = [
  { days: 1, label: '+1 день' },
  { days: 3, label: '+3 дня' },
  { days: 7, label: '+1 неделя' },
] as const;

/** Accept the work, or return it with a comment and a new deadline. Only for whoever handed it out. */
export function ReviewPanel({ assignment, submissionId }: { assignment: Assignment; submissionId: string }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const user = useUser();
  const queryClient = useQueryClient();
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');
  const [days, setDays] = useState<number>(3);

  // Counted from the later of the current deadline and now, so the new date is always in the future.
  // The clock is read once when the panel opens: a render must not depend on «now».
  const [openedAt] = useState(() => Date.now());
  const newDue = new Date(Math.max(Date.parse(assignment.currentDueAt), openedAt) + days * DAY);
  const commentValid = comment.trim().length >= COMMENT_MIN;

  const mutation = useMutation({
    mutationFn: (decision: ReviewDecision) =>
      decideReview(
        assignment,
        submissionId,
        decision,
        user.role === 'Admin' && user.adminScope === 'Organization' ? assignment.branchId : null,
      ),
    onError: (error) => Alert.alert(t('Не удалось сохранить решение'), t(error.message)),
    // Also after a failure: the work may already have moved to «in review».
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment', assignment.id] }),
        queryClient.invalidateQueries({ queryKey: ['journal'] }),
      ]),
  });

  function approve(): void {
    const run = () => mutation.mutate({ decision: 'Approved', comment: null, reworkDueAt: null });
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert(t('Принять работу?'), t('Задание закроется как выполненное. Отменить это нельзя.'), [
      { text: t('Отмена'), style: 'cancel' },
      { text: t('Принять'), onPress: run },
    ]);
  }

  if (!returning) {
    return (
      <View style={{ gap: Space.sm }}>
        <PrimaryButton label={t('Принять работу')} onPress={approve} loading={mutation.isPending} />
        <SecondaryButton label={t('Вернуть на доработку')} onPress={() => setReturning(true)} />
      </View>
    );
  }

  return (
    <View style={[styles.form, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Field
        label={t('Что нужно исправить')}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={COMMENT_MAX}
        placeholder={t('Не меньше 10 символов')}
        autoFocus
      />
      <View style={{ gap: Space.sm }}>
        <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '500' }}>{t('Новый срок')}</Text>
        <View style={styles.shifts} accessibilityRole="radiogroup">
          {SHIFTS.map((shift) => {
            const selected = shift.days === days;
            return (
              <Pressable
                key={shift.days}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setDays(shift.days)}
                style={[styles.shift, { borderColor: selected ? c.brand : c.border, backgroundColor: selected ? c.brandSoft : c.surface }]}
              >
                <Text style={{ color: selected ? c.brand : c.textSecondary, fontSize: 14, fontWeight: '600' }}>{t(shift.label)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: c.text, fontSize: 15 }}>
          {newDue.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <PrimaryButton
        label={t('Вернуть на доработку')}
        loading={mutation.isPending}
        disabled={!commentValid}
        onPress={() => mutation.mutate({ decision: 'NeedsRework', comment: comment.trim(), reworkDueAt: newDue.toISOString() })}
      />
      <SecondaryButton label={t('Отмена')} onPress={() => setReturning(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { borderWidth: 1, borderRadius: Radius.lg, padding: Space.md, gap: Space.md },
  shifts: { flexDirection: 'row', gap: Space.sm },
  shift: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.md, minHeight: 44 },
});

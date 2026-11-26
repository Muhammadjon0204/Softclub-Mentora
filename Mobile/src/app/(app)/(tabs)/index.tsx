import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { Space } from '@/constants/theme';
import { AssignmentRow, RowSeparator } from '@/features/assignments/AssignmentRow';
import { groupAssignments, SECTION_TITLE, type SectionKey } from '@/features/assignments/grouping';
import { useAssignments, usePeopleNames } from '@/features/assignments/queries';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { SecondaryButton, StateMessage } from '@/ui/primitives';
import { Screen, Segmented } from '@/ui/Screen';

export default function AssignmentsScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useUser();
  const query = useAssignments();
  const nameOf = usePeopleNames();
  // A lead both hands work out and receives it; the two lists are not mixed.
  const [scope, setScope] = useState<'team' | 'mine'>('team');

  const items = useMemo(() => {
    const all = query.data ?? [];
    if (user.role !== 'Lead') return all;
    return all.filter((a) => (a.assignedToId === user.id) === (scope === 'mine'));
  }, [query.data, user, scope]);

  const sections = useMemo(() => groupAssignments(items), [items]);
  const openCount = sections.filter((s) => s.key !== 'done' && s.key !== 'review').reduce((n, s) => n + s.data.length, 0);
  const ownWork = user.role === 'Mentor' || (user.role === 'Lead' && scope === 'mine');

  let body: JSX.Element;
  if (query.isPending) {
    body = <StateMessage loading title={t('Загружаем задания…')} />;
  } else if (query.isError) {
    body = (
      <StateMessage
        title={t('Не удалось загрузить задания')}
        detail={t(query.error.message)}
        action={<SecondaryButton label={t('Повторить')} onPress={() => void query.refetch()} />}
      />
    );
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: Space.xxl }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
        ListEmptyComponent={
          <StateMessage
            title={t('Заданий пока нет')}
            detail={
              user.role === 'Mentor'
                ? t('Когда лид назначит задание, оно появится здесь.')
                : ownWork
                  ? t('Здесь будут задания, которые выдали вам.')
                  : t('Новые задания пока создаются на сайте.')
            }
          />
        }
        renderSectionHeader={({ section }) => <SectionHeader sectionKey={section.key} count={section.data.length} />}
        renderItem={({ item, section }) => (
          <AssignmentRow assignment={item} section={section.key} person={ownWork ? null : nameOf(item.assignedToId)} />
        )}
        ItemSeparatorComponent={RowSeparator}
      />
    );
  }

  return (
    <Screen
      title={user.role === 'Mentor' ? t('Мои задания') : t('Задания')}
      subtitle={query.isSuccess ? (openCount === 0 ? t('Нет открытых заданий') : `${t('В работе')}: ${openCount}`) : null}
      header={
        user.role === 'Lead' ? (
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'team', label: t('Команда') },
              { value: 'mine', label: t('Мои') },
            ]}
          />
        ) : null
      }
    >
      {body}
    </Screen>
  );
}

function SectionHeader({ sectionKey, count }: { sectionKey: SectionKey; count: number }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const color = sectionKey === 'overdue' ? c.danger : c.textSecondary;
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color }]}>{t(SECTION_TITLE[sectionKey])}</Text>
      <Text style={{ fontSize: 13, color: c.textMuted }}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm, paddingHorizontal: Space.lg, paddingTop: Space.xl, paddingBottom: Space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
});

import { useMemo } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { Space } from '@/constants/theme';
import { AssignmentRow, RowSeparator } from '@/features/assignments/AssignmentRow';
import { awaitingMyReview, useAssignments, usePeopleNames } from '@/features/assignments/queries';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { SecondaryButton, StateMessage } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';

/** Handed-in work waiting for this lead's or administrator's decision, longest-waiting first. */
export default function ReviewScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const query = useAssignments();
  const nameOf = usePeopleNames();
  const items = useMemo(() => awaitingMyReview(query.data ?? []), [query.data]);

  return (
    <Screen title={t('На проверке')} subtitle={t('Работы по заданиям, которые выдали вы')}>
      {query.isPending ? (
        <StateMessage loading title={t('Загружаем задания…')} />
      ) : query.isError ? (
        <StateMessage
          title={t('Не удалось загрузить задания')}
          detail={t(query.error.message)}
          action={<SecondaryButton label={t('Повторить')} onPress={() => void query.refetch()} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingTop: Space.sm, paddingBottom: Space.xxl }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
          ListEmptyComponent={<StateMessage title={t('Проверять нечего')} detail={t('Сданные работы появятся здесь.')} />}
          renderItem={({ item }) => <AssignmentRow assignment={item} section="review" person={nameOf(item.assignedToId)} />}
          ItemSeparatorComponent={RowSeparator}
        />
      )}
    </Screen>
  );
}

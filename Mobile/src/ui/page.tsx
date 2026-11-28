import { useHeaderHeight } from 'expo-router/react-navigation';
import type { ReactElement, ReactNode } from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, View } from 'react-native';

import { Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

import { Button } from './kit';
import { StateMessage } from './primitives';

/** A pushed screen under the native header: scrolls, pulls to refresh, stays above the keyboard. */
export function Page({ children, onRefresh, refreshing = false, floating }: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pinned over the content, e.g. the «create» button. */
  floating?: ReactElement | null;
}): JSX.Element {
  const c = useColors();
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView
        contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: floating ? 96 : Space.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} /> : undefined}
      >
        {children}
      </ScrollView>
      {floating ?? null}
    </KeyboardAvoidingView>
  );
}

interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => unknown;
}

/** Loading and error states of a query, the same everywhere; `children` gets the loaded data. */
export function Loaded<T>({ query, children }: { query: QueryLike<T>; children: (data: T) => ReactNode }): JSX.Element {
  const { t } = useT();
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) {
    return (
      <StateMessage
        title={t('Не удалось загрузить')}
        detail={query.error ? t(query.error.message) : undefined}
        action={<Button kind="secondary" label={t('Повторить')} onPress={() => void query.refetch()} />}
      />
    );
  }
  return (
    <View>
      <StateMessage loading title={t('Загрузка…')} />
    </View>
  );
}

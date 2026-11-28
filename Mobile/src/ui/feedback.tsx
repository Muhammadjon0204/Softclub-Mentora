import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';

type Toast = { text: string; failed: boolean } | null;
const ToastContext = createContext<(text: string, failed?: boolean) => void>(() => undefined);

/** A short confirmation above the tab bar; failures stay a little longer. */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.failed ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = useCallback((text: string, failed = false) => setToast({ text, failed }), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 90 }]}>
          <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: toast.failed ? c.danger : c.text }]}>
            <Text style={{ color: c.background, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{toast.text}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Asks before something that cannot be undone. */
export function useConfirm() {
  const { t } = useT();
  return useMemo(
    () =>
      (title: string, message: string, action: string, run: () => void, destructive = false): void => {
        if (Platform.OS === 'web') {
          if (window.confirm(`${title}\n\n${message}`)) run();
          return;
        }
        Alert.alert(title, message, [
          { text: t('Отмена'), style: 'cancel' },
          { text: action, style: destructive ? 'destructive' : 'default', onPress: run },
        ]);
      },
    [t],
  );
}

/**
 * One change on the server: shows the outcome, then reloads whatever it may have touched. A change to a
 * task or a person shows up in lists, the overview and the journal, so everything is refreshed.
 */
export function useAction<Args extends unknown[]>(
  run: (...args: Args) => Promise<unknown>,
  options: { success?: string; onDone?: () => void } = {},
) {
  const { t } = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (args: Args) => run(...args),
    onSuccess: () => {
      if (options.success) toast(t(options.success));
      options.onDone?.();
    },
    onError: (error) => toast(t(error.message), true),
    onSettled: () => queryClient.invalidateQueries(),
  });
  return { run: (...args: Args) => mutation.mutate(args), busy: mutation.isPending };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
  toast: { borderRadius: Radius.md, paddingHorizontal: Space.lg, paddingVertical: Space.md, maxWidth: 440 },
});

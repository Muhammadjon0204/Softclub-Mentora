import { hashKey, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/session';
import { getActiveTeam } from '@/lib/team';
import { ToastProvider } from '@/ui/feedback';

// Keep the splash up until we know whether a saved session is still valid — no sign-in flash.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // The same request answers differently in each team, so the cache keeps them apart: switching
      // never shows the other team's data, and nothing has to be cleared.
      queryKeyHashFn: (key) => hashKey([getActiveTeam(), ...key]),
    },
  },
});

export default function RootLayout(): JSX.Element {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? Colors.dark : Colors.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.brand, background: c.background, card: c.surface, text: c.text, border: c.border },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={theme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigator(): JSX.Element {
  const { state } = useSession();

  useEffect(() => {
    if (state.status !== 'loading') SplashScreen.hide();
    // Nothing of one account's data may outlive its session on a shared phone.
    if (state.status === 'signedOut') queryClient.clear();
  }, [state.status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'signedOut'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

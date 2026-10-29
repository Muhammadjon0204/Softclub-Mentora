import { useSyncExternalStore } from 'react';

import { getTheme, setTheme, subscribeTheme, toggleTheme, type Theme } from './themeStore';

export interface UseThemeResult {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

const getServerSnapshot = (): Theme => 'light';

export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerSnapshot);
  return { theme, setTheme, toggleTheme };
}

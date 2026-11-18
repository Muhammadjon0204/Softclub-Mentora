import { Platform, useColorScheme } from 'react-native';

import { Colors, type Palette } from '@/constants/theme';

/** The palette for the system light/dark setting — the app follows the phone, like the site's default. */
export function useColors(): Palette {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}

/** On web (the development preview) native tabs render as a bar over the top of the screen. */
export const WEB_TAB_BAR_INSET = Platform.OS === 'web' ? 56 : 0;

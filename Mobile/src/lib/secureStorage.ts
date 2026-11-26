import * as SecureStore from 'expo-secure-store';

/**
 * Keychain (iOS) / Keystore (Android). The refresh token lives here and nowhere else on the device.
 * `secureStorage.web.ts` replaces this file in the browser build, which is for development only.
 */
export const secureStorage = {
  get: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  set: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value),
  remove: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
};

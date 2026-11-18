/**
 * Browser build (development preview only): there is no Keychain in a browser, so `localStorage`
 * stands in. Never ship the web build as a product — the native secure store is the point.
 */
function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const secureStorage = {
  get: async (key: string): Promise<string | null> => store()?.getItem(key) ?? null,
  set: async (key: string, value: string): Promise<void> => {
    store()?.setItem(key, value);
  },
  remove: async (key: string): Promise<void> => {
    store()?.removeItem(key);
  },
};

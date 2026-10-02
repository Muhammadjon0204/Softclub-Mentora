import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// A tab opened before a deploy still asks for chunk files of the old build, which the new image no
// longer has. One reload fetches the new index.html and its new chunk names. Guarded by how recently
// this page itself was loaded by a reload, so a chunk that keeps failing (server down) surfaces as an
// error instead of a reload loop — without sessionStorage, which the lint rules reserve.
const RELOAD_GUARD_MS = 10_000;

function justReloaded(): boolean {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return navigation?.type === 'reload' && performance.now() < RELOAD_GUARD_MS;
}

function withStaleChunkRecovery<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      if (!justReloaded()) {
        window.location.reload();
        // Keep Suspense waiting while the page reloads instead of flashing an error.
        return new Promise<T>(() => undefined);
      }
      throw error;
    });
}

export type PreloadableComponent = LazyExoticComponent<ComponentType> & { preload: () => Promise<unknown> };

/**
 * `React.lazy` for a page that is a named export, plus `preload()` so a section can warm up its other
 * pages while the user reads the first one.
 */
export function lazyPage<TModule>(load: () => Promise<TModule>, pick: (module: TModule) => ComponentType): PreloadableComponent {
  const recovering = withStaleChunkRecovery(load);
  const component = lazy(async () => ({ default: pick(await recovering()) }));
  return Object.assign(component, { preload: recovering });
}

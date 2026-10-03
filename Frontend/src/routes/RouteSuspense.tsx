import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { Spinner } from '../components/ui/Spinner';
import type { PreloadableComponent } from './lazyPage';

// Usually the chunk is already preloaded or arrives within this window, so nothing is shown at all
// rather than a spinner that blinks for a few frames.
const SHOW_LOADER_AFTER_MS = 300;

function PageLoader(): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, SHOW_LOADER_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="flex justify-center py-16" role="status" aria-live="polite">
      <Spinner className="h-5 w-5 text-brand" />
      <span className="sr-only">Загрузка страницы…</span>
    </div>
  );
}

/** A page inside a layout: the sidebar and header stay put while its code loads. */
export function PageSuspense({ children }: { children: ReactNode }): JSX.Element {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

/**
 * Warms up a role's other pages once the browser is idle, so the next click in the sidebar finds its
 * code already downloaded.
 */
export function PreloadPages({ pages }: { pages: PreloadableComponent[] }): null {
  useEffect(() => {
    const preload = (): void => {
      for (const page of pages) void page.preload().catch(() => undefined);
    };

    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(preload, { timeout: 3_000 });
      return () => {
        window.cancelIdleCallback(handle);
      };
    }

    const timer = setTimeout(preload, 1_500);
    return () => {
      clearTimeout(timer);
    };
  }, [pages]);

  return null;
}

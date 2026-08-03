import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Постоянный баннер при отсутствии сети. Сабмит форм блокируется отдельно —
 * тем же `useOnlineStatus`, очередь оффлайн-мутаций сознательно не создаётся.
 */
export function OfflineBanner(): JSX.Element | null {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3l18 18" strokeLinecap="round" />
        <path d="M8.5 16.5a5 5 0 017 0M5 13a9 9 0 013.5-2.2M19 13a9 9 0 00-3.2-2.1M2 9.5A14 14 0 016 7m16 2.5a14 14 0 00-5.5-2.9" strokeLinecap="round" />
        <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
      </svg>
      Нет соединения
    </div>
  );
}

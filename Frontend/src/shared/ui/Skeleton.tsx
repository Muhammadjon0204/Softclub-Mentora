interface SkeletonProps {
  className?: string;
}

/** Примитив скелетона. Всегда предпочитается spinner'у на весь экран (раздел 25 промпта). */
export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps): JSX.Element {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-surface-muted ${className}`} />;
}

export function SkeletonRow({ columns = 4 }: { columns?: number }): JSX.Element {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
      {Array.from({ length: columns }, (_, index) => (
        <Skeleton key={index} className={`h-3.5 ${index === 0 ? 'w-1/3' : 'flex-1'}`} />
      ))}
    </div>
  );
}

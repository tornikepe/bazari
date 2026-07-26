/**
 * Placeholder grid shown while products load. The shapes match `ProductCard`
 * so the page doesn't jump when the real cards arrive.
 */
export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card overflow-hidden">
          <div className="aspect-square skeleton" />
          <div className="flex flex-col gap-2.5 p-3.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
            <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100" />
            <div className="h-6 w-1/2 animate-pulse rounded bg-ink-100" />
            <div className="h-9 w-full animate-pulse rounded-control bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

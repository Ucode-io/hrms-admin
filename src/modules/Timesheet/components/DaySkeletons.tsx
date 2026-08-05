/** Скелетоны блоков дня: показываются, пока грузятся данные другой даты. */
export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-gray-200 dark:bg-white/10 ${className}`} />
);

export const SummaryCardsSkeleton = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={`summary-skeleton-${index}`}
        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-5 w-20" />
        <Skeleton className="mt-1.5 h-3 w-16" />
      </div>
    ))}
  </div>
);

export const TimelineSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="mt-4 h-3 w-full" />
    <Skeleton className="mt-2 h-14 w-full rounded-xl" />
  </div>
);

export const EntriesSkeleton = () => (
  <div className="divide-y divide-gray-100 dark:divide-gray-800">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={`entries-skeleton-${index}`} className="flex items-center gap-6 px-5 py-3.5">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

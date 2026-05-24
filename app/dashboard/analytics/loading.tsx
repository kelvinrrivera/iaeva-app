import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="rounded-2xl border border-black/5 bg-white p-6">
        <Skeleton className="mb-6 h-5 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

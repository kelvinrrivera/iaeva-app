import { Skeleton } from '@/components/ui/Skeleton';

export default function AvailabilityLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Skeleton className="h-8 w-48" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}

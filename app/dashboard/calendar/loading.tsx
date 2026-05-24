import { Skeleton } from '@/components/ui/Skeleton';

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      <div className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-6" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={`d-${i}`} className="h-24" />
          ))}
        </div>
      </div>
    </div>
  );
}

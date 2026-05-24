import { Skeleton } from '@/components/ui/Skeleton';

export default function PlansLoading() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Skeleton className="h-9 w-96 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-10 w-28" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex gap-2">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
            <Skeleton className="h-11 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

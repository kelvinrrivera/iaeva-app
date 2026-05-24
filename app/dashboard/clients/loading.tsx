import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}

import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function BillingLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-8 w-32" />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

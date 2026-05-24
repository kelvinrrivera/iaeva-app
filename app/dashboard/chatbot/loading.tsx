import { Skeleton } from '@/components/ui/Skeleton';

export default function ChatbotLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="h-[500px] flex flex-col gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 1 ? 'flex-row-reverse' : ''}`}>
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className={`h-16 rounded-2xl ${i % 2 === 1 ? 'w-2/3' : 'w-3/4'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

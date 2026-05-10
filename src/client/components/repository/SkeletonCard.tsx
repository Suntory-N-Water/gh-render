import { Card, CardContent, CardHeader } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';

export function SkeletonCard() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-2'>
          <Skeleton className='h-5 w-48' />
          <Skeleton className='h-5 w-16' />
        </div>
        <div className='flex gap-4 mt-1'>
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-4 w-16' />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-3/4 mt-2' />
        <Skeleton className='h-8 w-24 mt-4' />
      </CardContent>
    </Card>
  );
}

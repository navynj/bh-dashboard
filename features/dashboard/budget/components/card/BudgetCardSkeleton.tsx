'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function BudgetCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('min-w-0 overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-6 w-24" />
      </CardHeader>
      <CardContent className="h-full space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
        <ChartSkeleton className="max-h-[200px]" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'mx-auto flex aspect-square items-center justify-center rounded-lg bg-muted/50',
        className,
      )}
      aria-hidden
    >
      <Skeleton className="size-16 rounded-full" />
    </div>
  );
}

export default BudgetCardSkeleton;

'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ChartSkeleton } from '@/features/dashboard/budget/components/card/BudgetCardSkeleton';

/**
 * Placeholder layout matching weekly revenue: donut, totals, category rows, daily bars.
 */
export default function WeeklyRevenueSectionSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading weekly revenue">
      <div className="flex flex-col gap-4 sm:items-center">
        <ChartSkeleton className="max-h-[200px] min-h-[180px] w-full max-w-[280px]" />
        <div className="w-full space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-8 w-32" />
              <Skeleton className="ml-auto h-5 w-24" />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <div className="flex aspect-[16/7] min-h-[200px] w-full max-w-none items-end gap-1.5 rounded-lg border border-dashed border-muted/60 bg-muted/20 p-2 pt-6">
        {[42, 58, 48, 66, 52, 72, 45].map((pct, i) => (
          <Skeleton
            key={i}
            className="w-full min-w-0 rounded-sm"
            style={{ height: `${pct}%` }}
          />
        ))}
      </div>
    </div>
  );
}

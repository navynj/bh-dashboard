'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { WeekRangeNav } from '@/components/ui/control/week-range-nav';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useCallback, useState } from 'react';
import RevenueChart from '../chart/RevenueChart';
import RevenueDailyBarChart from '../chart/RevenueDailyBarChart';
import RevenueSummary from '../chart/RevenueSummary';
import type { RevenuePeriodData } from '../types';
import WeeklyRevenueSectionSkeleton from './WeeklyRevenueSectionSkeleton';

type WeeklyRevenueCardProps = {
  locationId: string;
  yearMonth: string;
  initialData: RevenuePeriodData;
  initialWeekOffset: number;
  className?: string;
};

export default function WeeklyRevenueCard({
  locationId,
  yearMonth,
  initialData,
  initialWeekOffset,
  className,
}: WeeklyRevenueCardProps) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<RevenuePeriodData>(initialData);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (weekOffset: number) => {
      setLoading(true);
      try {
        const q = new URLSearchParams({
          locationId,
          yearMonth,
          weekOffset: String(weekOffset),
        });
        const res = await fetch(
          `/api/dashboard/revenue/clover?${q.toString()}`,
          {
            cache: 'no-store',
          },
        );
        const j = (await res.json()) as {
          ok?: boolean;
          data?: RevenuePeriodData;
        };
        if (j.ok && j.data) {
          setData(j.data);
        }
      } finally {
        setLoading(false);
      }
    },
    [locationId, yearMonth],
  );

  const onWeekChange = useCallback(
    (weekOffset: number) => {
      void load(weekOffset);
    },
    [load],
  );

  const showWeeklySkeleton = loading;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <div className="rounded-lg border bg-background/80 p-3 sm:p-4">
        <div className="flex max-xl:flex-col gap-2 flex-row items-center justify-between gap-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  !open && '-rotate-90',
                )}
                aria-hidden
              />
              <span>Weekly Clover Sales</span>
            </button>
          </CollapsibleTrigger>
          {yearMonth != null && yearMonth !== '' && (
            <WeekRangeNav
              key={`${yearMonth}-${initialWeekOffset}`}
              yearMonth={yearMonth}
              initialWeekOffset={initialWeekOffset}
              onWeekChange={onWeekChange}
              disabled={loading}
              previousAriaLabel="Previous week"
              nextAriaLabel="Next week"
            />
          )}
        </div>

        <CollapsibleContent className="overflow-hidden">
          <div
            className={cn(
              'mt-4 space-y-4',
              showWeeklySkeleton && 'pointer-events-none',
            )}
          >
            {showWeeklySkeleton ? (
              <WeeklyRevenueSectionSkeleton />
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <RevenueSummary
                    totalRevenue={data.totalRevenue}
                    targetRevenue={data.targetRevenue}
                  />
                  <RevenueChart categories={data.categories} />
                </div>
                {data.dailyBars &&
                  data.dailyBars.length > 0 &&
                  data.dailyBarSegmentKeys &&
                  data.dailyBarSegmentKeys.length > 0 &&
                  data.dailyBarSegmentLabels &&
                  data.dailyBarSegmentLabels.length ===
                    data.dailyBarSegmentKeys.length && (
                    <RevenueDailyBarChart
                      rows={data.dailyBars}
                      segmentKeys={data.dailyBarSegmentKeys}
                      segmentLabels={data.dailyBarSegmentLabels}
                    />
                  )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

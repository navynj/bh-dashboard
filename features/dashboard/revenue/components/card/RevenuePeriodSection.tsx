'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { WeekRangeNav } from '@/components/ui/control/week-range-nav';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import RevenueChart from '../chart/RevenueChart';
import RevenueDailyBarChart from '../chart/RevenueDailyBarChart';
import RevenueSummary from '../chart/RevenueSummary';
import RevenueCategoryList from '../list/RevenueCategoryList';
import type { RevenuePeriodData } from '../types';
import WeeklyRevenueSectionSkeleton from './WeeklyRevenueSectionSkeleton';

type RevenuePeriodSectionProps = {
  title: string;
  data: RevenuePeriodData;
  /** When true, show prev/next week and date range in the header. */
  showWeekNavigation?: boolean;
  /** When true, render the daily stacked bar chart (weekly view). */
  showBarChart?: boolean;
  /** When true, list income categories below the chart (monthly P&L view). */
  showCategoryList?: boolean;
  defaultOpen?: boolean;
  className?: string;
  /** Required with `showWeekNavigation`: dashboard month (YYYY-MM) for week picker. */
  yearMonth?: string;
  /** Notified when the user changes week (Sunday–Saturday); `weekOffset` is relative to the first week of `yearMonth`. */
  onWeekChange?: (weekOffset: number) => void;
  isLoading?: boolean;
  /** Aligns week nav with server-fetched weekly data. */
  initialWeekOffset?: number;
};

export default function RevenuePeriodSection({
  title,
  data,
  showWeekNavigation = false,
  showBarChart = false,
  showCategoryList = true,
  defaultOpen = true,
  className,
  yearMonth,
  onWeekChange,
  isLoading = false,
  initialWeekOffset,
}: RevenuePeriodSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const showWeeklySkeleton = isLoading && showWeekNavigation;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <div className="rounded-lg border bg-background/80 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
              <span>{title}</span>
            </button>
          </CollapsibleTrigger>
          {showWeekNavigation && yearMonth != null && yearMonth !== '' && (
            <WeekRangeNav
              key={`${yearMonth}-${initialWeekOffset ?? 'default'}`}
              yearMonth={yearMonth}
              initialWeekOffset={initialWeekOffset}
              onWeekChange={onWeekChange}
              disabled={isLoading}
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
                <div className="flex flex-col gap-4 sm:items-center">
                  <RevenueChart categories={data.categories} />
                  <RevenueSummary
                    totalRevenue={data.totalRevenue}
                    targetRevenue={data.targetRevenue}
                  />
                </div>
                {showCategoryList && (
                  <RevenueCategoryList categories={data.categories} />
                )}
                {showBarChart &&
                  data.dailyBars &&
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

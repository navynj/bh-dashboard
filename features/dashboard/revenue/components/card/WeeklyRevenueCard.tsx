'use client';

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WeekRangeNav } from '@/components/ui/control/week-range-nav';
import { cn, formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import RevenueDailyBarChart from '../chart/RevenueDailyBarChart';
import HourlySalesHeatmap from '../chart/HourlySalesHeatmap';
import MenuPerformanceSection from '../chart/MenuPerformanceSection';
import WeeklyCloverStatsRow from '../chart/WeeklyCloverStatsRow';
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
  const [data, setData] = useState<RevenuePeriodData>(initialData);

  useEffect(() => {
    if (data.cloverError) {
      console.error('[WeeklyRevenueCard] Clover error:', data.cloverError);
    }
  }, [data.cloverError]);
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
    <Card className={cn('min-w-0 overflow-hidden gap-2', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">
          Weekly Clover Sales
        </CardTitle>
        {yearMonth != null && yearMonth !== '' && (
          <CardAction>
            <WeekRangeNav
              key={`${yearMonth}-${initialWeekOffset}`}
              yearMonth={yearMonth}
              initialWeekOffset={initialWeekOffset}
              onWeekChange={onWeekChange}
              disabled={loading}
              previousAriaLabel="Previous week"
              nextAriaLabel="Next week"
            />
          </CardAction>
        )}
      </CardHeader>

      <CardContent
        className={cn(
          'space-y-4 pt-0',
          showWeeklySkeleton && 'pointer-events-none',
        )}
      >
        {showWeeklySkeleton ? (
          <WeeklyRevenueSectionSkeleton />
        ) : data.cloverNotConfigured ? (
          <p className="text-sm text-muted-foreground">
            No Clover credentials configured for this location. Set the{' '}
            <span className="font-medium text-foreground">Clover Token</span>{' '}
            and <span className="font-medium text-foreground">Merchant ID</span>{' '}
            on the Locations page.
          </p>
        ) : data.cloverError ? (
          <p className="text-sm text-muted-foreground">
            Clover error — check the browser console for details.
          </p>
        ) : (
          <div className="space-y-5">
            {/* ── Row 1: Stats (full width) ── */}
            <WeeklyCloverStatsRow
              totalRevenue={data.totalRevenue}
              prevWeekRevenue={data.prevWeekRevenue}
              transactionCount={data.transactionCount}
              avgTicketSize={data.avgTicketSize}
            />

            {/* ── Row 2: Bar chart + daily list | Menu performance ── */}
            {data.dailyBars &&
              data.dailyBars.length > 0 &&
              data.dailyBarSegmentKeys &&
              data.dailyBarSegmentKeys.length > 0 &&
              data.dailyBarSegmentLabels &&
              data.dailyBarSegmentLabels.length ===
                data.dailyBarSegmentKeys.length && (
                <div className="grid gap-4 max-lg:grid-cols-1 grid-cols-2">
                  {/* Left: bar chart + daily list */}
                  <div className="space-y-3">
                    <RevenueDailyBarChart
                      rows={data.dailyBars}
                      segmentKeys={data.dailyBarSegmentKeys}
                      segmentLabels={data.dailyBarSegmentLabels}
                    />
                    <div className="divide-y rounded-lg border text-sm">
                      {data.dailyBars.map((row) => {
                        const pct =
                          data.totalRevenue > 0
                            ? (row.total / data.totalRevenue) * 100
                            : 0;
                        return (
                          <div
                            key={row.date}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            <span className="w-8 shrink-0 font-medium">
                              {row.label}
                            </span>
                            <span className="text-xs text-muted-foreground w-16 shrink-0">
                              {format(parseISO(row.date), 'MMM d')}
                            </span>
                            <div className="flex flex-1 items-baseline justify-end gap-2">
                              <span
                                className={cn(
                                  'tabular-nums',
                                  row.total === 0
                                    ? 'text-muted-foreground'
                                    : 'font-medium',
                                )}
                              >
                                {row.total === 0
                                  ? '—'
                                  : formatCurrency(row.total)}
                              </span>
                              {pct > 0 && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {pct.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: menu performance */}
                  {data.topMenuItems && data.topMenuItems.length > 0 && (
                    <MenuPerformanceSection
                      topMenuItems={data.topMenuItems}
                      bottomMenuItems={data.bottomMenuItems ?? []}
                      seasonalMenuItems={data.seasonalMenuItems}
                    />
                  )}
                </div>
              )}

            {/* ── Row 3: Hourly heatmap (full width) ── */}
            {data.dailyBars && data.dailyBars.length > 0 && (
              <div className="rounded-lg border p-3">
                <HourlySalesHeatmap
                  dayHourlySales={data.dayHourlySales ?? []}
                  weekDates={data.dailyBars.map((r) => ({
                    date: r.date,
                    label: r.label,
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

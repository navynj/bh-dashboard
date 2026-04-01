'use client';

import { useCallback, useState } from 'react';
import RevenuePeriodSection from './RevenuePeriodSection';
import type { RevenuePeriodData } from '../types';

type WeeklyRevenueCardProps = {
  locationId: string;
  yearMonth: string;
  initialData: RevenuePeriodData;
  initialWeekOffset: number;
};

export default function WeeklyRevenueCard({
  locationId,
  yearMonth,
  initialData,
  initialWeekOffset,
}: WeeklyRevenueCardProps) {
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
        const res = await fetch(`/api/dashboard/revenue/clover?${q.toString()}`, {
          cache: 'no-store',
        });
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

  return (
    <RevenuePeriodSection
      title="Weekly Clover Sales"
      data={data}
      showWeekNavigation
      showBarChart
      showCategoryList={false}
      defaultOpen
      yearMonth={yearMonth}
      initialWeekOffset={initialWeekOffset}
      onWeekChange={onWeekChange}
      isLoading={loading}
    />
  );
}

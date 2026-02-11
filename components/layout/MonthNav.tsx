'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { nextMonth, parseYearMonth, prevMonth } from '@/lib/utils';
import { MONTH_NAMES } from '@/constants/date';

export default function MonthNav({
  currentYearMonth,
}: {
  currentYearMonth: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { year, month } = parseYearMonth(currentYearMonth);
  const displayLabel = `${MONTH_NAMES[month]} ${year}`;
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);

  const go = (yearMonth: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('yearMonth', yearMonth);
    router.push(`/budget?${params.toString()}`);
  };

  return (
    <nav className="flex items-center justify-center gap-4 py-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => go(prev)}
      >
        ←
      </Button>
      <span
        className="min-w-[180px] text-center font-medium"
        aria-live="polite"
      >
        {displayLabel}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next month"
        onClick={() => go(next)}
      >
        →
      </Button>
    </nav>
  );
}

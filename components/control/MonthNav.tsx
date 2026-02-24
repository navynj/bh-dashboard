'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { YearMonthPicker } from '@/components/ui/year-month-picker';
import { useNavigationProgress } from '@/components/providers/NavigationProgress';
import {
  getCurrentYearMonth,
  nextMonth,
  parseYearMonth,
  prevMonth,
} from '@/lib/utils';

export default function MonthNav({
  currentYearMonth,
}: {
  currentYearMonth: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const effectiveYearMonth =
    searchParams.get('yearMonth') ?? currentYearMonth ?? getCurrentYearMonth();
  const { year, month } = parseYearMonth(effectiveYearMonth);
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);
  const currentYearMonthLimit = getCurrentYearMonth();
  const canGoNext = next <= currentYearMonthLimit;

  const navigationProgress = useNavigationProgress();

  const go = (yearMonth: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('yearMonth', yearMonth);
    const targetUrl = `${pathname}?${params.toString()}`;
    const currentUrl = `${pathname}?${searchParams.toString()}`;
    if (targetUrl === currentUrl) return;
    navigationProgress?.startNavigation();
    router.push(targetUrl);
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
      <YearMonthPicker
        value={effectiveYearMonth}
        onChange={(yearMonth) => {
          if (yearMonth <= currentYearMonthLimit) go(yearMonth);
        }}
        maxYearMonth={currentYearMonthLimit}
        triggerClassName="min-w-[180px]"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next month"
        disabled={!canGoNext}
        onClick={() => canGoNext && go(next)}
      >
        →
      </Button>
    </nav>
  );
}

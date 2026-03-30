'use client';

import { Button } from '@/components/ui/button';
import {
  getWeekOffsetContainingToday,
  WEEK_STARTS_ON,
} from '@/features/dashboard/revenue/utils/week-range';
import { cn } from '@/lib/utils';
import { addWeeks, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export { WEEK_STARTS_ON };

export type WeekRangeNavProps = {
  /** Current dashboard month (YYYY-MM). Offsets are from the Sunday–Saturday week that contains the 1st. */
  yearMonth: string;
  /**
   * Called when the user moves to another week (prev/next). Not called on initial mount — parent
   * should already have data for the initial week (e.g. from SSR).
   */
  onWeekChange?: (weekOffset: number) => void;
  disabled?: boolean;
  previousAriaLabel?: string;
  nextAriaLabel?: string;
  className?: string;
  /** When set (e.g. from SSR), initial week matches server-fetched data. */
  initialWeekOffset?: number;
};

/**
 * Computes the Sunday–Saturday range for a week offset from the first week of `yearMonth`.
 */
export function getWeekRangeForYearMonth(
  yearMonth: string,
  weekOffset: number,
): {
  weekStart: Date;
  weekEnd: Date;
  startDate: string;
  endDate: string;
  rangeLabel: string;
} {
  const monthStart = parseISO(`${yearMonth}-01`);
  const baseWeekStart = startOfWeek(monthStart, {
    weekStartsOn: WEEK_STARTS_ON,
  });
  const weekStart = addWeeks(baseWeekStart, weekOffset);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON });
  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(weekEnd, 'yyyy-MM-dd');
  const rangeLabel = `${format(weekStart, 'MMMM d')} ~ ${format(weekEnd, 'MMMM d')}`;
  return { weekStart, weekEnd, startDate, endDate, rangeLabel };
}

export { getWeekOffsetContainingToday } from '@/features/dashboard/revenue/utils/week-range';

/**
 * Previous / next control with a centered Sunday–Saturday range label.
 * Owns week offset state and notifies via `onWeekChange`.
 */
export function WeekRangeNav({
  yearMonth,
  onWeekChange,
  disabled = false,
  previousAriaLabel = 'Previous week',
  nextAriaLabel = 'Next week',
  className,
  initialWeekOffset,
}: WeekRangeNavProps) {
  const [weekOffset, setWeekOffset] = useState(() =>
    initialWeekOffset !== undefined
      ? initialWeekOffset
      : getWeekOffsetContainingToday(yearMonth),
  );
  const onWeekChangeRef = useRef(onWeekChange);

  useEffect(() => {
    onWeekChangeRef.current = onWeekChange;
  }, [onWeekChange]);

  const { rangeLabel } = getWeekRangeForYearMonth(yearMonth, weekOffset);

  /** Avoid notifying on mount / Strict Mode re-runs — that duplicated `/api/dashboard/revenue` after SSR. */
  const prevWeekOffsetRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevWeekOffsetRef.current === null) {
      prevWeekOffsetRef.current = weekOffset;
      return;
    }
    if (prevWeekOffsetRef.current !== weekOffset) {
      prevWeekOffsetRef.current = weekOffset;
      onWeekChangeRef.current?.(weekOffset);
    }
  }, [weekOffset]);

  const goPrev = () => setWeekOffset((o) => o - 1);
  const goNext = () => setWeekOffset((o) => o + 1);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 pl-6 sm:pl-0',
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className="h-7 w-7"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          goPrev();
        }}
        aria-label={previousAriaLabel}
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <span className="text-muted-foreground min-w-[10rem] text-center text-xs tabular-nums sm:text-sm">
        {rangeLabel}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className="h-7 w-7"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          goNext();
        }}
        aria-label={nextAriaLabel}
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

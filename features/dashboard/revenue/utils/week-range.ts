import {
  addWeeks,
  differenceInCalendarWeeks,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';

/** Sunday (0) through Saturday (6), US-style week — shared with `WeekRangeNav`. */
export const WEEK_STARTS_ON = 0 as const;

/**
 * Week offset (from the month’s first-week anchor) for the Sunday–Saturday week that contains `today`,
 * when `today` falls in `yearMonth`; otherwise 0. Safe for server components.
 */
export function getWeekOffsetContainingToday(
  yearMonth: string,
  today = new Date(),
): number {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return 0;
  if (today.getFullYear() !== y || today.getMonth() !== m - 1) return 0;

  const monthStart = parseISO(`${yearMonth}-01`);
  const baseWeekStart = startOfWeek(monthStart, {
    weekStartsOn: WEEK_STARTS_ON,
  });
  const todayWeekStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  return differenceInCalendarWeeks(todayWeekStart, baseWeekStart, {
    weekStartsOn: WEEK_STARTS_ON,
  });
}

export function weekRangeForMonth(
  yearMonth: string,
  weekOffset: number,
): { startDate: string; endDate: string; weekStart: Date; weekEnd: Date } {
  const monthStart = parseISO(`${yearMonth}-01`);
  const baseWeekStart = startOfWeek(monthStart, {
    weekStartsOn: WEEK_STARTS_ON,
  });
  const weekStart = addWeeks(baseWeekStart, weekOffset);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON });
  return {
    weekStart,
    weekEnd,
    startDate: format(weekStart, 'yyyy-MM-dd'),
    endDate: format(weekEnd, 'yyyy-MM-dd'),
  };
}

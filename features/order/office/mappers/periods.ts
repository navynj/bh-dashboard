import { format, startOfWeek, addWeeks, subWeeks, endOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { Period } from '../types';

/**
 * Generate dynamic week-based period filters centered around the current date.
 * Returns: [2 weeks ago, last week, this week, next week]
 */
export function buildWeekPeriods(now = new Date()): Period[] {
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });

  const weeks = [
    { offset: -2, label: formatWeekLabel(subWeeks(thisWeekStart, 2)) },
    { offset: -1, label: formatWeekLabel(subWeeks(thisWeekStart, 1)) },
    { offset: 0, label: 'This week' },
    { offset: 1, label: formatWeekLabel(addWeeks(thisWeekStart, 1)) },
  ];

  return weeks.map((w) => {
    const start = addWeeks(thisWeekStart, w.offset);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return {
      id: `week_${w.offset}`,
      label: w.label,
      from: format(start, 'yyyy-MM-dd'),
      to: format(end, 'yyyy-MM-dd'),
    };
  });
}

function formatWeekLabel(weekStart: Date): string {
  const end = endOfWeek(weekStart, { weekStartsOn: 1 });
  const sameMonth = weekStart.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${format(weekStart, 'MMM d (EEE)', { locale: enUS })}–${format(end, 'd (EEE)', { locale: enUS })}`;
  }
  return `${format(weekStart, 'MMM d (EEE)', { locale: enUS })}–${format(end, 'MMM d (EEE)', { locale: enUS })}`;
}

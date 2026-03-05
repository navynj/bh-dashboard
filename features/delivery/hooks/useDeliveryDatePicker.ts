'use client';

import { useCallback, useMemo, useState } from 'react';
import { format, parseISO, addDays, startOfWeek, isSameDay } from 'date-fns';
import { todayDateStr } from '../lib/constants';

export function useDeliveryDatePicker(initialDateStr?: string) {
  const [dateStr, setDateStr] = useState(initialDateStr ?? todayDateStr);

  const selectedDate = useMemo(() => {
    try {
      const d = parseISO(dateStr);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  }, [dateStr]);

  const isToday = dateStr === todayDateStr();
  const goPrevDay = useCallback(() => {
    setDateStr(format(addDays(selectedDate, -1), 'yyyy-MM-dd'));
  }, [selectedDate]);
  const goNextDay = useCallback(() => {
    setDateStr(format(addDays(selectedDate, 1), 'yyyy-MM-dd'));
  }, [selectedDate]);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = useMemo(
    () => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)),
    [weekStart],
  );

  return {
    dateStr,
    setDateStr,
    selectedDate,
    isToday,
    goPrevDay,
    goNextDay,
    weekDays,
    isSameDay,
  };
}

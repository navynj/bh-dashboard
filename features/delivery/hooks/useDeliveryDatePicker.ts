'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    startOfWeek(selectedDate, { weekStartsOn: 0 }),
  );

  useEffect(() => {
    setVisibleWeekStart(startOfWeek(selectedDate, { weekStartsOn: 0 }));
  }, [selectedDate]);

  const isToday = dateStr === todayDateStr();
  const goPrevWeek = useCallback(() => {
    setVisibleWeekStart((w) => addDays(w, -7));
  }, []);
  const goNextWeek = useCallback(() => {
    setVisibleWeekStart((w) => addDays(w, 7));
  }, []);

  const weekDays = useMemo(
    () => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(visibleWeekStart, i)),
    [visibleWeekStart],
  );

  return {
    dateStr,
    setDateStr,
    selectedDate,
    isToday,
    goPrevWeek,
    goNextWeek,
    weekDays,
    isSameDay,
  };
}

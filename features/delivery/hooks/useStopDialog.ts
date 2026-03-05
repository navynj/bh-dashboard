'use client';

import { useCallback, useState } from 'react';
import type { DailySchedule } from '../types/delivery-schedule-types';

export function useStopDialog() {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<DailySchedule | null>(null);
  const [stopIndex, setStopIndex] = useState<number>(-1);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  const openEdit = useCallback((s: DailySchedule, idx: number) => {
    setSchedule(s);
    setStopIndex(idx);
    setInsertIndex(null);
    setOpen(true);
  }, []);

  const openAdd = useCallback((s: DailySchedule, atIndex?: number) => {
    setSchedule(s);
    setStopIndex(-1);
    setInsertIndex(atIndex ?? null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSchedule(null);
    setStopIndex(-1);
    setInsertIndex(null);
  }, []);

  return {
    open,
    schedule,
    stopIndex,
    insertIndex,
    openEdit,
    openAdd,
    close,
    setSchedule,
    setStopIndex,
    setInsertIndex,
    setOpen,
  };
}

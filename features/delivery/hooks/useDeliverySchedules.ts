'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type {
  DailySchedule,
  DriverRow,
  Stop,
} from '../types/delivery-schedule-types';
import { parseApiError } from '../lib/api-error';
import { normalizeCreatedSchedule, stopsToPayload } from '../lib/schedule-api';

type UseDeliverySchedulesOverview = {
  mode: 'overview';
  drivers: DriverRow[];
  schedulesByDriverId: Record<string, DailySchedule>;
  fixedScheduleDriverIdsByDay: Record<number, Set<string>>;
  getSchedule: (driverId: string) => DailySchedule | undefined;
  setSchedule: (driverId: string, schedule: DailySchedule | null) => void;
};

type UseDeliverySchedulesDriver = {
  mode: 'driver';
  driver: DriverRow | null;
  schedule: DailySchedule | null;
  hasFixedScheduleForDate: boolean;
  getSchedule: (driverId: string) => DailySchedule | undefined;
  setSchedule: (driverId: string, schedule: DailySchedule | null) => void;
};

type Common = {
  loading: boolean;
  fetchData: () => Promise<void>;
  handleReorderStops: (
    schedule: DailySchedule,
    newStops: Stop[],
  ) => Promise<void>;
  handleDeleteStop: (
    schedule: DailySchedule,
    stopIndex: number,
  ) => Promise<void>;
  optimisticUpdateScheduleStops: (driverId: string, newStops: Stop[]) => void;
  handleAddStopWhenNoSchedule: (
    driver: DriverRow,
  ) => Promise<DailySchedule | null>;
};

export type UseDeliverySchedulesResult = (
  | UseDeliverySchedulesOverview
  | UseDeliverySchedulesDriver
) &
  Common;

export function useDeliverySchedules(
  dateStr: string,
  options?: { driverId?: string },
): UseDeliverySchedulesResult {
  const driverId = options?.driverId;

  const [loading, setLoading] = useState(true);

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [schedulesByDriverId, setSchedulesByDriverId] = useState<
    Record<string, DailySchedule>
  >({});
  const [fixedScheduleDriverIdsByDay, setFixedScheduleDriverIdsByDay] =
    useState<Record<number, Set<string>>>({});

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [schedule, setScheduleState] = useState<DailySchedule | null>(null);
  const [hasFixedScheduleForDate, setHasFixedScheduleForDate] = useState(false);

  const getSchedule = useCallback(
    (id: string): DailySchedule | undefined => {
      if (driverId) {
        return id === driverId ? (schedule ?? undefined) : undefined;
      }
      return schedulesByDriverId[id];
    },
    [driverId, schedule, schedulesByDriverId],
  );

  const setSchedule = useCallback(
    (id: string, s: DailySchedule | null) => {
      if (driverId) {
        if (id === driverId) setScheduleState(s);
        return;
      }
      setSchedulesByDriverId((prev) => {
        if (s == null) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: s };
      });
    },
    [driverId],
  );

  const fetchData = useCallback(async () => {
    if (driverId) {
      const [driversRes, schedulesRes, fixedRes] = await Promise.all([
        fetch('/api/delivery/driver'),
        fetch(
          `/api/delivery/daily-schedule?date=${encodeURIComponent(dateStr)}&driverId=${encodeURIComponent(driverId)}`,
        ),
        fetch(
          `/api/delivery/fixed-schedule?driverId=${encodeURIComponent(driverId)}`,
        ),
      ]);
      if (!driversRes.ok) {
        setDriver(null);
      } else {
        const list: DriverRow[] = await driversRes.json();
        const d = Array.isArray(list)
          ? (list.find((x) => x.id === driverId) ?? null)
          : null;
        setDriver(d);
      }
      if (schedulesRes.ok) {
        const list = await schedulesRes.json();
        setScheduleState(
          Array.isArray(list) && list.length > 0 ? list[0] : null,
        );
      } else {
        setScheduleState(null);
      }
      const dayOfWeek = new Date(dateStr + 'T00:00:00.000Z').getUTCDay();
      if (fixedRes.ok) {
        const fixedList = await fixedRes.json();
        const days = Array.isArray(fixedList) ? fixedList : [];
        setHasFixedScheduleForDate(
          days.some((r: { dayOfWeek: number }) => r.dayOfWeek === dayOfWeek),
        );
      } else {
        setHasFixedScheduleForDate(false);
      }
    } else {
      const [driversRes, schedulesRes, fixedRes] = await Promise.all([
        fetch('/api/delivery/driver'),
        fetch(
          `/api/delivery/daily-schedule?date=${encodeURIComponent(dateStr)}`,
        ),
        fetch('/api/delivery/fixed-schedule'),
      ]);
      if (!driversRes.ok) {
        setDrivers([]);
      } else {
        const data = await driversRes.json();
        setDrivers(Array.isArray(data) ? data : []);
      }
      const byDriver: Record<string, DailySchedule> = {};
      if (schedulesRes.ok) {
        const list = await schedulesRes.json();
        (Array.isArray(list) ? list : []).forEach((s: DailySchedule) => {
          byDriver[s.driverId] = s;
        });
      }
      setSchedulesByDriverId(byDriver);
      const byDay: Record<number, Set<string>> = {};
      if (fixedRes.ok) {
        const fixedList = await fixedRes.json();
        (Array.isArray(fixedList) ? fixedList : []).forEach(
          (row: { driverId: string; dayOfWeek: number }) => {
            if (!byDay[row.dayOfWeek]) byDay[row.dayOfWeek] = new Set();
            byDay[row.dayOfWeek].add(row.driverId);
          },
        );
      }
      setFixedScheduleDriverIdsByDay(byDay);
    }
  }, [dateStr, driverId]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleReorderStops = useCallback(
    async (s: DailySchedule, newStops: Stop[]) => {
      const payload = stopsToPayload(newStops);
      const prev = getSchedule(s.driverId);
      setSchedule(s.driverId, { ...s, stops: newStops });
      try {
        const res = await fetch(`/api/delivery/daily-schedule/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stops: payload }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        toast.success('Order updated');
      } catch (e) {
        if (prev) setSchedule(s.driverId, prev);
        toast.error(e instanceof Error ? e.message : 'Failed to reorder');
        fetchData();
      }
    },
    [getSchedule, setSchedule, fetchData],
  );

  const handleDeleteStop = useCallback(
    async (s: DailySchedule, stopIndex: number) => {
      const stops = s.stops ?? [];
      if (stopIndex < 0 || stopIndex >= stops.length) return;
      const newStops = stops.filter((_, i) => i !== stopIndex);
      const payload = stopsToPayload(newStops);
      const prev = getSchedule(s.driverId);
      setSchedule(s.driverId, { ...s, stops: newStops });
      try {
        const res = await fetch(`/api/delivery/daily-schedule/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stops: payload }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        toast.success('Stop deleted');
      } catch (e) {
        if (prev) setSchedule(s.driverId, prev);
        toast.error(e instanceof Error ? e.message : 'Failed to delete');
        fetchData();
      }
    },
    [getSchedule, setSchedule, fetchData],
  );

  const optimisticUpdateScheduleStops = useCallback(
    (id: string, newStops: Stop[]) => {
      const current = getSchedule(id);
      if (!current) return;
      setSchedule(id, { ...current, stops: newStops });
    },
    [getSchedule, setSchedule],
  );

  const handleAddStopWhenNoSchedule = useCallback(
    async (driver: DriverRow) => {
      try {
        const res = await fetch('/api/delivery/daily-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: dateStr,
            driverId: driver.id,
            stops: [],
          }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const created = await res.json();
        const newSchedule = normalizeCreatedSchedule(created, driver);
        setSchedule(driver.id, newSchedule);
        return newSchedule;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Failed to create schedule',
        );
        return null;
      }
    },
    [dateStr, setSchedule],
  );

  const common: Common = {
    loading,
    fetchData,
    handleReorderStops,
    handleDeleteStop,
    optimisticUpdateScheduleStops,
    handleAddStopWhenNoSchedule,
  };

  if (driverId) {
    return {
      ...common,
      mode: 'driver',
      driver,
      schedule,
      hasFixedScheduleForDate,
      getSchedule,
      setSchedule,
    };
  }

  return {
    ...common,
    mode: 'overview',
    drivers,
    schedulesByDriverId,
    fixedScheduleDriverIdsByDay,
    getSchedule,
    setSchedule,
  };
}

'use client';

import { Button } from '@/components/ui/button';
import { Droppable } from '@/components/ui/drag-and-drop';
import { CalendarCheck, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { DailySchedule, Stop } from '../types/delivery-schedule-types';
import { SortableStopRow } from './SortableStopRow';

function isStopCompleted(stop: Stop): boolean {
  if (!stop.departedAt) return false;
  const tasks = stop.tasks ?? [];
  return tasks.every((t) => t.completedAt != null);
}

export function DriverScheduleCard({
  schedule,
  dateStr,
  onRefresh,
  hasFixedScheduleForDate,
  onEditStop,
  onAddStop,
  onReorderStops,
  onDeleteStop,
}: {
  schedule: DailySchedule;
  dateStr: string;
  onRefresh: () => Promise<unknown>;
  hasFixedScheduleForDate: boolean;
  onEditStop: (schedule: DailySchedule, stopIndex: number) => void;
  onAddStop: (schedule: DailySchedule, atIndex?: number) => void;
  onReorderStops: (schedule: DailySchedule, newStops: Stop[]) => void;
  onDeleteStop: (schedule: DailySchedule, stopIndex: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const stops = schedule.stops ?? [];

  const handleSetItems = useCallback(
    (action: React.SetStateAction<Stop[]>) => {
      const newStops = typeof action === 'function' ? action(stops) : action;
      if (newStops.length !== stops.length) return;
      onReorderStops(schedule, newStops);
    },
    [schedule, stops, onReorderStops],
  );

  const handleAddFromFixed = useCallback(async () => {
    setAdding(true);
    try {
      const res = await fetch('/api/delivery/daily-schedule/from-fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, driverId: schedule.driverId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? res.statusText);
      }
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setAdding(false);
    }
  }, [dateStr, schedule.driverId, onRefresh]);

  return (
    <div className={'space-y-1'}>
      <Droppable items={stops} setItems={handleSetItems}>
        {stops.map((stop, idx) => {
          const nextStopHasArrived = stop.arrivedAt != null;
          return (
            <div key={stop.id} className="flex flex-col items-stretch gap-0">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="shrink-0 h-4 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddStop(schedule, idx);
                }}
                disabled={nextStopHasArrived}
                aria-label={
                  nextStopHasArrived
                    ? 'Cannot add stop before an arrived stop'
                    : 'Add stop here'
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <SortableStopRow
                stop={stop}
                idx={idx}
                schedule={schedule}
                onEditStop={onEditStop}
                onDeleteStop={onDeleteStop}
                defaultCollapsedWhenCompleted
              />
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full h-8 justify-center text-muted-foreground hover:text-foreground"
          onClick={() => onAddStop(schedule, stops.length)}
          aria-label="Add stop at end"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add stop
        </Button>
      </Droppable>

      {hasFixedScheduleForDate && stops.length <= 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddFromFixed}
            disabled={adding}
          >
            <CalendarCheck className="h-3.5 w-3.5 mr-1" />
            {adding ? 'Adding…' : 'Add from fixed schedule'}
          </Button>
        </div>
      )}
    </div>
  );
}

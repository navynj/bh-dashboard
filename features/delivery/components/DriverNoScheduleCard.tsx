'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CalendarCheck, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { DriverRow } from '../types/delivery-schedule-types';

export function DriverNoScheduleCard({
  driver,
  driverDisplayName,
  dateStr,
  onRefresh,
  hasFixedScheduleForDate,
  onAddStop,
  contentOnly = false,
}: {
  driver: DriverRow;
  driverDisplayName: string;
  dateStr: string;
  onRefresh: () => Promise<unknown>;
  hasFixedScheduleForDate: boolean;
  onAddStop: (driver: DriverRow) => void;
  /** When true, render only the inner content (no collapsible header). */
  contentOnly?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  const handleAddFromFixed = useCallback(async () => {
    setAdding(true);
    try {
      const res = await fetch('/api/delivery/daily-schedule/from-fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, driverId: driver.id }),
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
  }, [dateStr, driver.id, onRefresh]);

  const content = (
    <div
      className={
        contentOnly ? 'space-y-1' : 'border-t px-3 py-3 space-y-1 bg-muted/20'
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full h-8 justify-center text-muted-foreground hover:text-foreground"
        onClick={() => onAddStop(driver)}
        aria-label="Add stop at end"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add stop
      </Button>
      {hasFixedScheduleForDate && (
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

  if (contentOnly) {
    return content;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
          >
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="font-medium flex-1">
              <Link
                href={`/delivery/drivers/${driver.id}/fixed-schedule`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {driverDisplayName}
              </Link>
            </span>
            <span className="text-muted-foreground text-sm">0 stops</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>{content}</CollapsibleContent>
      </div>
    </Collapsible>
  );
}

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { DriverRow } from '../types/delivery-schedule-types';
import { Button } from '@/components/ui/button';

export type DeliveryOverviewSchedulePanelProps = {
  selectedDriver: DriverRow | undefined;
  isToday: boolean;
  selectedDate: Date;
  children: ReactNode;
};

/**
 * Right column shell: title, optional driver link, date line, scrollable body.
 */
export function DeliveryOverviewSchedulePanel({
  selectedDriver,
  isToday,
  selectedDate,
  children,
}: DeliveryOverviewSchedulePanelProps) {
  return (
    <div className="border rounded-lg flex flex-col min-h-0 w-full bg-card">
      <div className="p-4 border-b">
        <div className="flex justify-between gap-2">
          <h2 className="font-medium">Driver schedule</h2>
          {selectedDriver && (
            <Button variant="outline" size="sm">
              <Link
                href={`/delivery/drivers/${selectedDriver.id}/fixed-schedule`}
              >
                Fixed schedule
              </Link>
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {isToday ? "Today's" : format(selectedDate, 'MMM d')} — stops and
          tasks.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">{children}</div>
    </div>
  );
}

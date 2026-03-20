'use client';

import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { LocateFixed } from 'lucide-react';
import type { DriverRow } from '../types/delivery-schedule-types';

export type DeliveryOverviewDriverToolbarProps = {
  drivers: DriverRow[];
  loading: boolean;
  selectedDriverId: string | null;
  onDriverChange: (driverId: string | null) => void;
  loadingTracking: boolean;
  lastTrackedAt: string | null;
  onTrackCurrentLocation: () => void;
};

export function DeliveryOverviewDriverToolbar({
  drivers,
  loading,
  selectedDriverId,
  onDriverChange,
  loadingTracking,
  lastTrackedAt,
  onTrackCurrentLocation,
}: DeliveryOverviewDriverToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        <label
          htmlFor="overview-driver"
          className="text-sm text-muted-foreground shrink-0"
        >
          Driver
        </label>
        <select
          id="overview-driver"
          className="border rounded-md px-3 py-2 bg-background min-w-[200px]"
          value={selectedDriverId ?? ''}
          onChange={(e) => onDriverChange(e.target.value || null)}
          disabled={loading || drivers.length === 0}
        >
          {drivers.length === 0 ? (
            <option value="">No drivers</option>
          ) : (
            drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name ?? d.email ?? d.id}
              </option>
            ))
          )}
        </select>
        <span className="text-sm text-muted-foreground">
          {loadingTracking ? (
            <span className="tabular-nums">Last tracked: …</span>
          ) : lastTrackedAt ? (
            <span className="tabular-nums">
              Last tracked:{' '}
              {format(new Date(lastTrackedAt), 'MMM d, yyyy · h:mm a')}
            </span>
          ) : (
            <span>Last tracked: —</span>
          )}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        disabled={loadingTracking || !selectedDriverId}
        onClick={() => void onTrackCurrentLocation()}
      >
        <LocateFixed className="h-4 w-4" aria-hidden />
        Track current location
      </Button>
    </div>
  );
}

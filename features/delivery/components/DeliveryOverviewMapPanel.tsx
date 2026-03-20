'use client';

import DriverTrackingMap from '@/features/delivery/components/DriverTrackingMap';
import type { DeliveryOverviewTrackingData } from '../types/delivery-overview';

export type DeliveryOverviewMapPanelProps = {
  loadingTracking: boolean;
  tracking: DeliveryOverviewTrackingData | null;
  selectedDriverId: string | null;
  dateStr: string;
  focusDriverLocationRequest: number;
};

export function DeliveryOverviewMapPanel({
  loadingTracking,
  tracking,
  selectedDriverId,
  dateStr,
  focusDriverLocationRequest,
}: DeliveryOverviewMapPanelProps) {
  return (
    <div className="lg:col-span-2 h-[560px] shrink-0 rounded-lg overflow-hidden border bg-card">
      {loadingTracking ? (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Loading…
        </div>
      ) : tracking ? (
        <DriverTrackingMap
          key={`${selectedDriverId}-${dateStr}`}
          className="h-full"
          currentLocation={tracking.currentLocation}
          stops={tracking.stops}
          path={tracking.path}
          focusDriverLocationRequest={focusDriverLocationRequest}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground px-4 text-center">
          {selectedDriverId
            ? 'No tracking data for this day'
            : 'Select a driver to see the map'}
        </div>
      )}
    </div>
  );
}

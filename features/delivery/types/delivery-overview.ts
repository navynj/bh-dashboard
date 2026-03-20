import type { TrackingStop } from '@/features/delivery/components/DriverTrackingMap';

/** Response shape from GET /api/delivery/driver/[id]/tracking */
export type DeliveryOverviewTrackingData = {
  driver: { id: string; name: string | null };
  date: string;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  stops: TrackingStop[];
  path: { lat: number; lng: number; createdAt: string }[];
};

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { DeliveryOverviewTrackingData } from '../types/delivery-overview';

/**
 * Map + “Track current location” state for delivery overview: polling, focus requests, office ping.
 */
export function useDeliveryOverviewTracking(
  selectedDriverId: string | null,
  dateStr: string,
) {
  const [tracking, setTracking] = useState<DeliveryOverviewTrackingData | null>(
    null,
  );
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [focusDriverLocationRequest, setFocusDriverLocationRequest] =
    useState(0);
  const pingPollTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const fetchTracking = useCallback(
    async (
      background = false,
    ): Promise<DeliveryOverviewTrackingData | null> => {
      if (!selectedDriverId) {
        setTracking(null);
        return null;
      }
      if (!background) setLoadingTracking(true);
      try {
        const res = await fetch(
          `/api/delivery/driver/${selectedDriverId}/tracking?date=${encodeURIComponent(dateStr)}`,
        );
        if (!res.ok) {
          setTracking(null);
          return null;
        }
        const data = (await res.json()) as DeliveryOverviewTrackingData;
        setTracking(data);
        return data;
      } finally {
        setLoadingTracking(false);
      }
    },
    [selectedDriverId, dateStr],
  );

  useEffect(() => {
    void fetchTracking(false);
    const interval = setInterval(() => void fetchTracking(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  useEffect(() => {
    setFocusDriverLocationRequest(0);
  }, [selectedDriverId, dateStr]);

  useEffect(() => {
    return () => {
      pingPollTimeoutsRef.current.forEach(clearTimeout);
      pingPollTimeoutsRef.current = [];
    };
  }, []);

  const requestFreshDriverLocation = useCallback(async () => {
    if (!selectedDriverId) return;
    pingPollTimeoutsRef.current.forEach(clearTimeout);
    pingPollTimeoutsRef.current = [];

    const res = await fetch(
      `/api/delivery/driver/${selectedDriverId}/request-location`,
      { method: 'POST', credentials: 'same-origin' },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error: string }).error)
          : 'Could not request driver location',
      );
      return;
    }

    const data = await fetchTracking(true);
    const lastSeenUpdatedAt = {
      current: data?.currentLocation?.updatedAt ?? null,
    };

    setFocusDriverLocationRequest((n) => n + 1);

    for (let i = 1; i <= 12; i++) {
      const id = window.setTimeout(() => {
        void (async () => {
          const next = await fetchTracking(true);
          const u = next?.currentLocation?.updatedAt ?? null;
          if (u != null && u !== lastSeenUpdatedAt.current) {
            lastSeenUpdatedAt.current = u;
            setFocusDriverLocationRequest((n) => n + 1);
          }
        })();
      }, i * 2000);
      pingPollTimeoutsRef.current.push(
        id as unknown as ReturnType<typeof setTimeout>,
      );
    }
  }, [selectedDriverId, fetchTracking]);

  return {
    tracking,
    loadingTracking,
    focusDriverLocationRequest,
    fetchTracking,
    requestFreshDriverLocation,
  };
}

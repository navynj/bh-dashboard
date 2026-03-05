'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { DeliveryLocationRow, LocationOption } from '@/features/delivery/types/locations';
import { patchDeliveryLocation, deleteDeliveryLocation } from '@/features/delivery/lib/location-api';

type UseDeliveryLocationsProps = {
  initialLocations: DeliveryLocationRow[];
  locationOptions: LocationOption[];
};

export function useDeliveryLocations({
  initialLocations,
  locationOptions,
}: UseDeliveryLocationsProps) {
  const [locations, setLocations] = useState<DeliveryLocationRow[]>(initialLocations);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DeliveryLocationRow>>({});

  useEffect(() => {
    setLocations(initialLocations);
  }, [initialLocations]);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  const updateLocation = useCallback(
    async (row: DeliveryLocationRow, field: string, value: unknown) => {
      const previous = locations.find((l) => l.id === row.id);
      if (!previous) return;
      setLocations((prev) =>
        prev.map((l) => (l.id === row.id ? { ...l, [field]: value } : l)),
      );
      try {
        await patchDeliveryLocation(row.id, { [field]: value });
        toast.success('Updated');
      } catch (e) {
        setLocations((prev) =>
          prev.map((l) => (l.id === row.id ? previous : l)),
        );
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    },
    [locations],
  );

  const deleteById = useCallback(async (id: string) => {
    try {
      await deleteDeliveryLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
      toast.success('Deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }, []);

  const openEdit = useCallback((row: DeliveryLocationRow) => {
    setEditId(row.id);
    setEditForm({
      name: row.name,
      address: row.address ?? '',
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
      locationId: row.locationId ?? undefined,
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    try {
      const body: Record<string, unknown> = {};
      if (editForm.name !== undefined) body.name = editForm.name;
      if (editForm.address !== undefined) body.address = editForm.address || null;
      if (editForm.lat !== undefined) body.lat = editForm.lat ?? null;
      if (editForm.lng !== undefined) body.lng = editForm.lng ?? null;
      if (editForm.locationId !== undefined)
        body.locationId = editForm.locationId || null;
      await patchDeliveryLocation(editId, body);
      setLocations((prev) =>
        prev.map((l) =>
          l.id === editId
            ? {
                ...l,
                ...editForm,
                address: editForm.address ?? null,
                locationId: editForm.locationId ?? null,
              }
            : l,
        ),
      );
      toast.success('Updated');
      setEditId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }, [editId, editForm]);

  return {
    locations,
    locationOptions,
    updateLocation,
    deleteById,
    editId,
    editForm,
    setEditForm,
    setEditId,
    openEdit,
    saveEdit,
    refresh,
  };
}

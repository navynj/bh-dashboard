'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  DailySchedule,
  Stop,
  Task,
} from '../types/delivery-schedule-types';
import type { DeliveryLocationOption } from '../types/locations';

type StopForm = {
  deliveryLocationId: string | null;
  name: string;
  address: string;
  tasks: { id?: string; title: string }[];
};

export function StopDialog({
  open,
  schedule,
  stopIndex,
  insertIndex,
  onClose,
  onSaved,
  onOptimisticUpdate,
  onRevert,
}: {
  open: boolean;
  schedule: DailySchedule;
  stopIndex: number;
  insertIndex: number | null;
  onClose: () => void;
  onSaved: () => void;
  onOptimisticUpdate?: (driverId: string, newStops: Stop[]) => void;
  onRevert?: () => void;
}): React.JSX.Element {
  const isAdd = stopIndex < 0;
  const existingStop = !isAdd ? schedule.stops?.[stopIndex] : null;
  const stopDeparted = existingStop?.departedAt != null;
  const [locations, setLocations] = useState<DeliveryLocationOption[]>([]);
  const [form, setForm] = useState<StopForm>({
    deliveryLocationId: null,
    name: '',
    address: '',
    tasks: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingStop) {
      setForm({
        deliveryLocationId: existingStop.deliveryLocationId ?? null,
        name: existingStop.name ?? '',
        address: existingStop.address ?? '',
        tasks: (existingStop.tasks ?? []).map((t) => ({
          id: t.id,
          title: t.title ?? '',
        })),
      });
    } else {
      setForm({
        deliveryLocationId: null,
        name: '',
        address: '',
        tasks: [],
      });
    }
  }, [open, existingStop]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/delivery/location')
      .then((r) => r.json())
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => setLocations([]));
  }, [open]);

  const updateForm = useCallback((patch: Partial<StopForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const setStopFromLocation = useCallback(
    (locationId: string) => {
      const loc = locations.find((l) => l.id === locationId);
      if (!loc) return;
      setForm((prev) => ({
        ...prev,
        deliveryLocationId: locationId,
        name: loc.name,
        address: loc.address ?? '',
      }));
    },
    [locations],
  );

  const addTask = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { title: '' }],
    }));
  }, []);

  const updateTask = useCallback((idx: number, title: string) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t, i) => (i === idx ? { ...t, title } : t)),
    }));
  }, []);

  const removeTask = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== idx),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Stop name is required');
      return;
    }
    const validTasks = form.tasks.filter((t) => t.title.trim());
    const stops = schedule.stops ?? [];
    const newStopPayload = {
      deliveryLocationId: form.deliveryLocationId || null,
      name,
      address: form.address.trim() || undefined,
      tasks: validTasks.map((t) => ({ id: t.id, title: t.title.trim() })),
    };
    const existingPayload = stops.map((s) => ({
      id: s.id,
      deliveryLocationId: s.deliveryLocationId ?? null,
      name: s.name,
      address: s.address ?? undefined,
      tasks: (s.tasks ?? []).map((t) => ({ id: t.id, title: t.title })),
    }));
    const payloadStops = isAdd
      ? insertIndex != null &&
        insertIndex >= 0 &&
        insertIndex <= existingPayload.length
        ? [
            ...existingPayload.slice(0, insertIndex),
            newStopPayload,
            ...existingPayload.slice(insertIndex),
          ]
        : [...existingPayload, newStopPayload]
      : stops.map((s, i) => {
          if (i !== stopIndex) {
            return {
              id: s.id,
              deliveryLocationId: s.deliveryLocationId ?? null,
              name: s.name,
              address: s.address ?? undefined,
              tasks: (s.tasks ?? []).map((t) => ({
                id: t.id,
                title: t.title,
              })),
            };
          }
          return {
            id: s.id,
            deliveryLocationId: form.deliveryLocationId || null,
            name,
            address: form.address.trim() || undefined,
            tasks: validTasks.map((t) => ({
              id: t.id,
              title: t.title.trim(),
            })),
          };
        });

    if (!isAdd && onOptimisticUpdate) {
      const newStops: Stop[] = stops.map((s, i) =>
        i === stopIndex
          ? {
              ...s,
              name,
              address: form.address.trim() || null,
              deliveryLocationId: form.deliveryLocationId ?? null,
              tasks: validTasks.map((t, ti) => ({
                id: (s.tasks?.[ti] as Task | undefined)?.id ?? `t-${ti}`,
                sequence: ti,
                title: t.title.trim(),
                completedAt:
                  (s.tasks?.[ti] as Task | undefined)?.completedAt ?? null,
              })),
            }
          : s,
      );
      onOptimisticUpdate(schedule.driverId, newStops);
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/delivery/daily-schedule/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops: payloadStops }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? res.statusText);
      }
      toast.success(isAdd ? 'Stop added' : 'Stop updated');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
      onRevert?.();
    } finally {
      setSaving(false);
    }
  }, [
    schedule,
    stopIndex,
    insertIndex,
    isAdd,
    form,
    onSaved,
    onOptimisticUpdate,
    onRevert,
  ]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isAdd ? 'Add stop' : 'Edit stop'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {locations.length > 0 && (
            <div>
              <Label className="text-xs">From list (optional)</Label>
              <Select
                value={form.deliveryLocationId ?? '__none__'}
                onValueChange={(v) => {
                  if (v === '__none__') {
                    updateForm({
                      deliveryLocationId: null,
                      name: '',
                      address: '',
                    });
                  } else {
                    setStopFromLocation(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    — Occasional (enter below)
                  </SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="Location name"
            />
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => updateForm({ address: e.target.value })}
              placeholder="Full address"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Tasks</Label>
              {!stopDeparted && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addTask}
                >
                  <Plus className="h-3 w-3 mr-1" /> Task
                </Button>
              )}
            </div>
            {stopDeparted ? (
              <p className="text-muted-foreground text-xs mb-2">
                Cannot add or edit tasks after the driver has departed this
                stop.
              </p>
            ) : null}
            <ul className="space-y-1">
              {form.tasks.map((t, j) => (
                <li key={j} className="flex items-center gap-2">
                  <Input
                    className="flex-1 h-8"
                    value={t.title}
                    onChange={(e) => updateTask(j, e.target.value)}
                    placeholder="Task description"
                    readOnly={stopDeparted}
                    disabled={stopDeparted}
                  />
                  {!stopDeparted && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeTask(j)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isAdd ? 'Add stop' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

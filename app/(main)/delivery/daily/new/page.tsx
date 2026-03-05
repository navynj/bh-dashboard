'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

type DeliveryLocationOption = {
  id: string;
  name: string;
  address: string | null;
};
type DriverOption = { id: string; name: string | null; email: string | null };

type StopForm = {
  deliveryLocationId: string | null;
  name: string;
  address: string;
  tasks: { title: string }[];
};

export default function NewDailySchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFromQuery = searchParams.get('date');
  const driverIdFromQuery = searchParams.get('driverId');
  const [dateStr, setDateStr] = useState(
    dateFromQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery)
      ? dateFromQuery
      : new Date().toISOString().slice(0, 10),
  );
  const [driverId, setDriverId] = useState('');
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [locations, setLocations] = useState<DeliveryLocationOption[]>([]);
  const [stops, setStops] = useState<StopForm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFocusStopIndex, setPendingFocusStopIndex] = useState<
    number | null
  >(null);
  const lastTaskInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (pendingFocusStopIndex != null) {
      lastTaskInputRefs.current[pendingFocusStopIndex]?.focus();
      setPendingFocusStopIndex(null);
    }
  }, [stops, pendingFocusStopIndex]);

  useEffect(() => {
    Promise.all([
      fetch('/api/delivery/driver').then((r) => r.json()),
      fetch('/api/delivery/location').then((r) => r.json()),
    ]).then(([driverData, locationData]) => {
      setDrivers(driverData);
      setLocations(locationData);
      if (driverIdFromQuery && driverData.some((d: DriverOption) => d.id === driverIdFromQuery)) {
        setDriverId(driverIdFromQuery);
      }
    });
  }, [driverIdFromQuery]);

  const addStop = useCallback(() => {
    setStops((prev) => [
      ...prev,
      {
        deliveryLocationId: null,
        name: '',
        address: '',
        tasks: [],
      },
    ]);
  }, []);

  const updateStop = useCallback((index: number, patch: Partial<StopForm>) => {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }, []);

  const setStopFromLocation = useCallback(
    (index: number, locationId: string) => {
      const loc = locations.find((l) => l.id === locationId);
      if (!loc) return;
      setStops((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                deliveryLocationId: locationId,
                name: loc.name,
                address: loc.address ?? '',
              }
            : s,
        ),
      );
    },
    [locations],
  );

  const addTask = useCallback((stopIndex: number) => {
    setStops((prev) =>
      prev.map((s, i) =>
        i === stopIndex ? { ...s, tasks: [...s.tasks, { title: '' }] } : s,
      ),
    );
    setPendingFocusStopIndex(stopIndex);
  }, []);

  const updateTask = useCallback(
    (stopIndex: number, taskIndex: number, title: string) => {
      setStops((prev) =>
        prev.map((s, i) =>
          i === stopIndex
            ? {
                ...s,
                tasks: s.tasks.map((t, j) =>
                  j === taskIndex ? { ...t, title } : t,
                ),
              }
            : s,
        ),
      );
    },
    [],
  );

  const removeStop = useCallback((index: number) => {
    setStops((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeTask = useCallback((stopIndex: number, taskIndex: number) => {
    setStops((prev) =>
      prev.map((s, i) =>
        i === stopIndex
          ? { ...s, tasks: s.tasks.filter((_, j) => j !== taskIndex) }
          : s,
      ),
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!driverId) {
      toast.error('Select a driver');
      return;
    }
    const validStops = stops.filter((s) => s.name.trim());
    if (validStops.length === 0) {
      toast.error('Add at least one stop with a name');
      return;
    }
    for (const s of validStops) {
      const hasTask = s.tasks.some((t) => t.title.trim());
      if (!hasTask) {
        toast.error(`Stop "${s.name}" has no tasks. Add at least one task.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/delivery/daily-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          driverId,
          stops: validStops.map((s) => ({
            deliveryLocationId: s.deliveryLocationId || null,
            name: s.name.trim(),
            address: s.address.trim() || undefined,
            tasks: s.tasks
              .filter((t) => t.title.trim())
              .map((t) => ({ title: t.title.trim() })),
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? res.statusText);
      }
      const created = await res.json();
      toast.success('Schedule created');
      router.push(`/delivery/daily/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }, [dateStr, driverId, stops, router]);

  const driverNames = Object.fromEntries(
    drivers.map((d) => [d.id, d.name || d.email || d.id]),
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Link href="/delivery/daily">Daily</Link>
        <span>/</span>
        <span>New schedule</span>
      </div>
      <h1 className="text-2xl font-semibold">New daily schedule</h1>

      <div className="space-y-2">
        <Label>Date</Label>
        <Input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-2">
        <Label>Driver</Label>
        <Select value={driverId} onValueChange={setDriverId}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Select driver" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {driverNames[d.id] ?? d.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Stops (order matters)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addStop}>
            <Plus className="h-4 w-4 mr-1" />
            Add stop
          </Button>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Choose from delivery locations or add an occasional stop (name &amp;
          address only).
        </p>
        <div className="space-y-4">
          {stops.map((stop, i) => (
            <div
              key={i}
              className="border rounded-lg p-4 space-y-3 bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Stop {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive"
                  onClick={() => removeStop(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2">
                {locations.length > 0 && (
                  <div>
                    <Label className="text-xs">From list (optional)</Label>
                    <Select
                      value={stop.deliveryLocationId ?? '__none__'}
                      onValueChange={(v) => {
                        if (v === '__none__') {
                          updateStop(i, {
                            deliveryLocationId: null,
                            name: '',
                            address: '',
                          });
                        } else {
                          setStopFromLocation(i, v);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select or add occasional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          — Occasional (enter below)
                        </SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                            {loc.address ? ` — ${loc.address}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!stop.deliveryLocationId && (
                  <>
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={stop.name}
                        onChange={(e) =>
                          updateStop(i, { name: e.target.value })
                        }
                        placeholder="Location name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Address</Label>
                      <Input
                        value={stop.address}
                        onChange={(e) =>
                          updateStop(i, { address: e.target.value })
                        }
                        placeholder="Full address"
                      />
                    </div>
                  </>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Tasks</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addTask(i)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Task
                  </Button>
                </div>
                <ul className="space-y-1">
                  {stop.tasks.map((task, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <Input
                        ref={(el) => {
                          if (j === stop.tasks.length - 1) {
                            lastTaskInputRefs.current[i] = el;
                          }
                        }}
                        className="flex-1 h-8"
                        value={task.title}
                        onChange={(e) => updateTask(i, j, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTask(i);
                          }
                        }}
                        placeholder="Task description"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeTask(i, j)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create schedule'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/delivery/daily">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}

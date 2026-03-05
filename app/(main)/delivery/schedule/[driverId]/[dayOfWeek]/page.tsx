'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type LocationOption = { id: string; name: string; address: string | null };
type TemplateStopForm = {
  id: string;
  deliveryLocationId: string | null;
  name: string;
  address: string;
  tasks: { title: string }[];
};

export default function RecurringScheduleEditPage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.driverId as string;
  const dayOfWeek = parseInt(params.dayOfWeek as string, 10);

  const [driverName, setDriverName] = useState('');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [stops, setStops] = useState<TemplateStopForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const taskInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const isValidDay = !Number.isNaN(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6;

  const fetchData = useCallback(async () => {
    if (!driverId || !isValidDay) return;
    const [templateRes, locData, drivers] = await Promise.all([
      fetch(
        `/api/delivery/fixed-schedule/template?driverId=${encodeURIComponent(driverId)}&dayOfWeek=${dayOfWeek}`,
      ),
      fetch('/api/delivery/location').then((r) => r.json()),
      fetch('/api/delivery/driver').then((r) => r.json()),
    ]);
    setLocations(locData ?? []);
    const driver = (drivers as { id: string; name: string | null; email: string | null }[]).find(
      (d) => d.id === driverId,
    );
    setDriverName(driver?.name ?? driver?.email ?? driverId);

    if (!templateRes.ok) {
      if (templateRes.status === 404) {
        setStops([]);
        return;
      }
      throw new Error('Failed to load template');
    }
    const data = await templateRes.json();
    if (data?.stops?.length) {
      setStops(
        data.stops.map(
          (s: {
            id?: string;
            name: string;
            address?: string | null;
            deliveryLocationId?: string | null;
            tasks?: { id?: string; title: string }[];
          }) => ({
            id: s.id ?? `stop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            deliveryLocationId: s.deliveryLocationId ?? null,
            name: s.name ?? '',
            address: s.address ?? '',
            tasks: (s.tasks ?? []).map((t: { title: string }) => ({
              title: t.title ?? '',
            })),
          }),
        ),
      );
    } else {
      setStops([]);
    }
  }, [driverId, dayOfWeek, isValidDay]);

  useEffect(() => {
    if (!driverId || !isValidDay) {
      setLoading(false);
      return;
    }
    fetchData()
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setLoading(false));
  }, [driverId, isValidDay, fetchData]);

  const updateStop = useCallback((index: number, patch: Partial<TemplateStopForm>) => {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }, []);

  const setStopFromLocation = useCallback(
    (index: number, locationId: string) => {
      const loc = locations.find((l) => l.id === locationId);
      if (!loc) return;
      updateStop(index, {
        deliveryLocationId: locationId,
        name: loc.name,
        address: loc.address ?? '',
      });
    },
    [locations, updateStop],
  );

  const addStop = useCallback(() => {
    setStops((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        deliveryLocationId: null,
        name: '',
        address: '',
        tasks: [],
      },
    ]);
  }, []);

  const removeStop = useCallback((index: number) => {
    setStops((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addTask = useCallback((stopIndex: number) => {
    setStops((prev) =>
      prev.map((s, i) =>
        i === stopIndex
          ? { ...s, tasks: [...s.tasks, { title: '' }] }
          : s,
      ),
    );
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

  const removeTask = useCallback((stopIndex: number, taskIndex: number) => {
    setStops((prev) =>
      prev.map((s, i) =>
        i === stopIndex
          ? { ...s, tasks: s.tasks.filter((_, j) => j !== taskIndex) }
          : s,
      ),
    );
  }, []);

  const handleSave = useCallback(async () => {
    const validStops = stops.filter((s) => s.name.trim());
    if (validStops.length === 0) {
      toast.error('Add at least one stop with a name');
      return;
    }
    for (const s of validStops) {
      const hasTask = s.tasks.some((t) => t.title.trim());
      if (!hasTask) {
        toast.error(`Stop "${s.name}" needs at least one task.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/delivery/fixed-schedule/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          dayOfWeek,
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
      toast.success('Recurring schedule saved');
      router.push('/delivery/schedule');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }, [driverId, dayOfWeek, stops, router]);

  if (!isValidDay) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Invalid day of week.</p>
        <Button variant="outline" asChild>
          <Link href="/delivery/schedule">Back to Fixed schedule</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-8 text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Link href="/delivery">Delivery</Link>
        <span>/</span>
        <Link href="/delivery/schedule">Fixed schedule</Link>
        <span>/</span>
        <span>
          {driverName} — {DAY_NAMES[dayOfWeek]}
        </span>
      </div>
      <h1 className="text-2xl font-semibold">
        Recurring schedule — {driverName} — {DAY_NAMES[dayOfWeek]}
      </h1>
      <p className="text-muted-foreground text-sm">
        Stops and tasks for this weekday. When you generate daily schedules for
        a date, this template is applied for the driver.
      </p>

      <div className="space-y-4">
        {stops.map((stop, i) => (
          <div
            key={stop.id}
            className="border rounded-lg p-4 space-y-3 bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
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
            {!stop.deliveryLocationId && (
              <>
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={stop.name}
                    onChange={(e) => updateStop(i, { name: e.target.value })}
                    placeholder="Location name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={stop.address}
                    onChange={(e) => updateStop(i, { address: e.target.value })}
                    placeholder="Full address"
                  />
                </div>
              </>
            )}
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
                          taskInputRefs.current[i] = el;
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

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addStop}>
          <Plus className="h-4 w-4 mr-1" />
          Add stop
        </Button>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save recurring schedule'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/delivery/schedule">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}

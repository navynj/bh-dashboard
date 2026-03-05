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
import { Droppable } from '@/components/ui/drag-and-drop';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type TaskForm = { id?: string; title: string };
type StopForm = {
  id: string;
  deliveryLocationId: string | null;
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  tasks: TaskForm[];
};
type DeliveryLocationOption = { id: string; name: string; address: string | null };

type SortableStopCardProps = {
  stop: StopForm;
  index: number;
  locations: DeliveryLocationOption[];
  onUpdateStop: (index: number, patch: Partial<StopForm>) => void;
  onSetStopFromLocation: (index: number, locationId: string) => void;
  onRemoveStop: (index: number) => void;
  onAddTask: (stopIndex: number) => void;
  onUpdateTask: (stopIndex: number, taskIndex: number, title: string) => void;
  onRemoveTask: (stopIndex: number, taskIndex: number) => void;
  lastTaskInputRefs: React.RefObject<Record<number, HTMLInputElement | null>>;
};

function SortableStopCard({
  stop,
  index: i,
  locations,
  onUpdateStop,
  onSetStopFromLocation,
  onRemoveStop,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  lastTaskInputRefs,
}: SortableStopCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: stop.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    flexShrink: 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="w-full min-w-0">
      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <span
            className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 rounded"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          </span>
          <span className="text-sm font-medium">Stop {i + 1}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive"
            onClick={() => onRemoveStop(i)}
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
                  onUpdateStop(i, {
                    deliveryLocationId: null,
                    name: '',
                    address: '',
                  });
                } else {
                  onSetStopFromLocation(i, v);
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
                onChange={(e) => onUpdateStop(i, { name: e.target.value })}
                placeholder="Location name"
              />
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={stop.address}
                onChange={(e) => onUpdateStop(i, { address: e.target.value })}
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
              onClick={() => onAddTask(i)}
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
                      (lastTaskInputRefs.current as Record<number, HTMLInputElement | null>)[i] = el;
                    }
                  }}
                  className="flex-1 h-8"
                  value={task.title}
                  onChange={(e) => onUpdateTask(i, j, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddTask(i);
                    }
                  }}
                  placeholder="Task description"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onRemoveTask(i, j)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function EditDailySchedulePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [dateStr, setDateStr] = useState('');
  const [driverName, setDriverName] = useState('');
  const [stops, setStops] = useState<StopForm[]>([]);
  const [locations, setLocations] = useState<DeliveryLocationOption[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchSchedule = useCallback(async () => {
    const [scheduleRes, locRes] = await Promise.all([
      fetch(`/api/delivery/daily-schedule/${id}`),
      fetch('/api/delivery/location'),
    ]);
    if (!scheduleRes.ok) throw new Error('Failed to load schedule');
    const schedule = await scheduleRes.json();
    const date = schedule.date;
    setDateStr(
      typeof date === 'string'
        ? date.slice(0, 10)
        : new Date(date).toISOString().slice(0, 10),
    );
    setDriverName(schedule.driver?.name ?? schedule.driverId ?? '');
    setStops(
      (schedule.stops ?? []).map((s: any, idx: number) => ({
        id: String(s.id ?? `stop-${idx}-${Date.now()}`),
        deliveryLocationId: s.deliveryLocationId ?? null,
        name: s.name ?? '',
        address: s.address ?? '',
        lat: s.lat,
        lng: s.lng,
        tasks: (s.tasks ?? []).map((t: any) => ({
          id: t.id,
          title: t.title ?? '',
        })),
      })),
    );
    if (locRes.ok) {
      const locData = await locRes.json();
      setLocations(locData);
    }
  }, [id]);

  useEffect(() => {
    fetchSchedule()
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [fetchSchedule]);

  const updateStop = useCallback((index: number, patch: Partial<StopForm>) => {
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
    const validStops = stops.filter((s) => s.name.trim());
    if (validStops.length === 0) {
      toast.error('At least one stop with a name is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/delivery/daily-schedule/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops: validStops.map((s) => ({
            id: s.id,
            deliveryLocationId: s.deliveryLocationId || null,
            name: s.name.trim(),
            address: s.address.trim() || undefined,
            lat: s.lat,
            lng: s.lng,
            tasks: s.tasks
              .filter((t) => t.title.trim())
              .map((t) => ({ id: t.id, title: t.title.trim() })),
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? res.statusText);
      }
      toast.success('Schedule updated');
      router.push(`/delivery/daily/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }, [id, stops, router]);

  if (loading) {
    return (
      <div className="py-8 text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Link href="/delivery/daily">Daily</Link>
        <span>/</span>
        <Link href={`/delivery/daily/${id}`}>Schedule</Link>
        <span>/</span>
        <span>Edit</span>
      </div>
      <h1 className="text-2xl font-semibold">Edit schedule</h1>
      <p className="text-muted-foreground text-sm">
        {dateStr} — {driverName}. Drag stops to change order.
      </p>

      <Droppable items={stops} setItems={setStops}>
        <div className="space-y-4">
          {stops.map((stop, i) => (
            <SortableStopCard
              key={stop.id}
              stop={stop}
              index={i}
              locations={locations}
              onUpdateStop={updateStop}
              onSetStopFromLocation={setStopFromLocation}
              onRemoveStop={removeStop}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onRemoveTask={removeTask}
              lastTaskInputRefs={lastTaskInputRefs}
            />
          ))}
        </div>
      </Droppable>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addStop}>
          <Plus className="h-4 w-4 mr-1" />
          Add stop
        </Button>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/delivery/daily/${id}`}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}

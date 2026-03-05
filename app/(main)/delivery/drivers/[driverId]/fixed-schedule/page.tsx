'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, MapPin, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type FixedScheduleRow = {
  id: string;
  driverId: string;
  dayOfWeek: number;
};

type TemplateTask = { id: string; sequence: number; title: string };
type TemplateStop = {
  id: string;
  sequence: number;
  name: string;
  address: string | null;
  deliveryLocationId: string | null;
  tasks: TemplateTask[];
};

type DayTemplate = { stops: TemplateStop[] };

export default function DriverFixedSchedulePage() {
  const params = useParams();
  const driverId = params.driverId as string;
  const [driverName, setDriverName] = useState('');
  const [schedules, setSchedules] = useState<FixedScheduleRow[]>([]);
  const [templatesByDay, setTemplatesByDay] = useState<
    Record<number, DayTemplate>
  >({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addDay, setAddDay] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    const [driversRes, scheduleRes] = await Promise.all([
      fetch('/api/delivery/driver'),
      fetch(
        `/api/delivery/fixed-schedule?driverId=${encodeURIComponent(driverId)}`,
      ),
    ]);
    if (!driversRes.ok) throw new Error('Failed to load driver');
    const driversList = await driversRes.json();
    const d = driversList.find((x: { id: string }) => x.id === driverId);
    setDriverName(d?.name ?? d?.email ?? driverId);

    if (!scheduleRes.ok) throw new Error('Failed to load fixed schedules');
    const list: FixedScheduleRow[] = await scheduleRes.json();
    setSchedules(list);

    const dayList = list.map((s) => s.dayOfWeek);
    const templates: Record<number, DayTemplate> = {};
    await Promise.all(
      dayList.map(async (dayOfWeek) => {
        const res = await fetch(
          `/api/delivery/fixed-schedule/template?driverId=${encodeURIComponent(driverId)}&dayOfWeek=${dayOfWeek}`,
        );
        if (res.ok) {
          const data = await res.json();
          templates[dayOfWeek] = { stops: data.stops ?? [] };
        } else {
          templates[dayOfWeek] = { stops: [] };
        }
      }),
    );
    setTemplatesByDay(templates);
  }, [driverId]);

  useEffect(() => {
    fetchData()
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [fetchData]);

  const handleAdd = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/delivery/fixed-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, dayOfWeek: addDay }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? res.statusText);
      }
      toast.success('Day added');
      setAddOpen(false);
      setAddDay(1);
      await fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  }, [driverId, addDay, fetchData]);

  const handleRemove = useCallback(
    async (dayOfWeek: number) => {
      try {
        const res = await fetch(
          `/api/delivery/fixed-schedule?driverId=${encodeURIComponent(driverId)}&dayOfWeek=${dayOfWeek}`,
          { method: 'DELETE' },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error ?? res.statusText);
        }
        toast.success('Removed');
        setSchedules((prev) => prev.filter((s) => s.dayOfWeek !== dayOfWeek));
        setTemplatesByDay((prev) => {
          const next = { ...prev };
          delete next[dayOfWeek];
          return next;
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to remove');
      }
    },
    [driverId],
  );

  const sortedSchedules = [...schedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  if (loading) {
    return (
      <div className="py-8 text-muted-foreground">
        Loading fixed schedule…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Link href="/delivery/drivers" className="hover:underline">
          Drivers
        </Link>
        <span>/</span>
        <Link href={`/delivery/drivers/${driverId}`} className="hover:underline">
          {driverName}
        </Link>
        <span>/</span>
        <span className="text-foreground">Fixed schedule</span>
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">
          Fixed schedule — {driverName}
        </h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add day
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add recurring day</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              Add a weekday for this driver. Then set stops and tasks for that
              day.
            </p>
            <div>
              <Label>Day of week</Label>
              <Select
                value={String(addDay)}
                onValueChange={(v) => setAddDay(parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={submitting}>
                {submitting ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-muted-foreground text-sm">
        One column per weekday. Edit a day to set stops and tasks. Use
        &quot;Generate from fixed&quot; on the Daily page to create that
        day&apos;s schedules.
      </p>

      {sortedSchedules.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          No days assigned. Add a day above.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {sortedSchedules.map((s) => {
              const dayOfWeek = s.dayOfWeek;
              const template = templatesByDay[dayOfWeek] ?? { stops: [] };
              const stops = template.stops;

              return (
                <div
                  key={s.id}
                  className="w-72 shrink-0 flex flex-col rounded-lg border bg-card"
                >
                  <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold">
                      {DAY_NAMES[dayOfWeek]}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7" asChild>
                        <Link
                          href={`/delivery/schedule/${driverId}/${dayOfWeek}`}
                          title="Edit schedule"
                        >
                          <Pencil className="h-3.5 w-3" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive"
                        onClick={() => handleRemove(dayOfWeek)}
                        aria-label={`Remove ${DAY_NAMES[dayOfWeek]}`}
                      >
                        <Trash2 className="h-3.5 w-3" />
                      </Button>
                    </span>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto max-h-[60vh] space-y-3">
                    {stops.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No stops.{' '}
                        <Link
                          href={`/delivery/schedule/${driverId}/${dayOfWeek}`}
                          className="text-primary hover:underline"
                        >
                          Set schedule
                        </Link>
                      </p>
                    ) : (
                      stops.map((stop, idx) => (
                        <div
                          key={stop.id}
                          className="rounded-md border bg-muted/30 p-2.5 space-y-2 text-sm"
                        >
                          <div className="flex items-start gap-1.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-primary text-xs font-medium">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium leading-tight">
                                {stop.name}
                              </p>
                              {stop.address && (
                                <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {stop.address}
                                </p>
                              )}
                            </div>
                          </div>
                          {stop.tasks?.length > 0 && (
                            <ul className="ml-6 space-y-0.5 border-l-2 border-muted pl-2">
                              {stop.tasks.map((t) => (
                                <li
                                  key={t.id}
                                  className="text-xs text-muted-foreground"
                                >
                                  {t.title}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, MapPin, CheckCircle, Clock } from 'lucide-react';

function safeFormatDate(value: string | null | undefined, fmt: string): string {
  if (value == null || value === '') return '';
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? String(value) : format(d, fmt);
  } catch {
    return String(value);
  }
}

type Task = {
  id: string;
  sequence: number;
  title: string;
  assignedById: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};
type Stop = {
  id: string;
  sequence: number;
  name: string;
  address: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
  deliveryLocation: { id: string; name: string; address: string | null } | null;
  tasks: Task[];
};
type Schedule = {
  id: string;
  date: string;
  driverId: string;
  driver: { id: string; name: string | null };
  stops: Stop[];
  createdAt: string;
  updatedAt: string;
};

export default function DailyScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/delivery/daily-schedule/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        setSchedule(null);
        return;
      }
      throw new Error('Failed to load');
    }
    const data = await res.json();
    setSchedule(data);
  }, [id]);

  useEffect(() => {
    fetchSchedule().finally(() => setLoading(false));
  }, [fetchSchedule]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this schedule?')) return;
    const res = await fetch(`/api/delivery/daily-schedule/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'Delete failed');
      return;
    }
    router.push('/delivery/daily');
  }, [id, router]);

  if (loading) {
    return (
      <div className="py-8 text-muted-foreground">Loading schedule…</div>
    );
  }
  if (!schedule) {
    return (
      <div className="py-8">
        <p className="text-destructive">Schedule not found.</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/delivery/daily">Back to Daily</Link>
        </Button>
      </div>
    );
  }

  const dateObj =
    schedule.date != null
      ? new Date(
          typeof schedule.date === 'string' && schedule.date.length === 10
            ? `${schedule.date}T00:00:00.000Z`
            : schedule.date,
        )
      : null;
  const dateLabel =
    dateObj && !Number.isNaN(dateObj.getTime())
      ? format(dateObj, 'PPP')
      : String(schedule?.date ?? '');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Link href="/delivery/daily" className="hover:underline">
          Daily
        </Link>
        <span>/</span>
        <span>{dateLabel}</span>
        <span>/</span>
        <span>{schedule.driver?.name ?? schedule.driverId}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {schedule.driver?.name ?? 'Driver'} — {dateLabel}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Created {safeFormatDate(schedule.createdAt, 'PPp')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/delivery/daily/${id}/edit`}>Edit</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {schedule.stops?.map((stop, idx) => (
          <div
            key={stop.id}
            className="border rounded-lg p-4 space-y-3 bg-card"
          >
            <div className="flex items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{stop.name}</h2>
                {stop.address && (
                  <p className="text-muted-foreground text-sm flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {stop.address}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                  {stop.arrivedAt ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Arrived {safeFormatDate(stop.arrivedAt, 'PPp')}
                    </span>
                  ) : (
                    <span>Arrived —</span>
                  )}
                  {stop.departedAt ? (
                    <span className="flex items-center gap-1">
                      Departed {safeFormatDate(stop.departedAt, 'PPp')}
                    </span>
                  ) : (
                    <span>Departed —</span>
                  )}
                </div>
              </div>
            </div>
            <ul className="ml-9 space-y-2">
              {stop.tasks?.map((task) => (
                <li
                  key={task.id}
                  className="flex items-start gap-2 text-sm border-l-2 border-muted pl-2 py-1"
                >
                  <div className="flex-1 min-w-0">
                    <span className={task.completedAt ? 'line-through text-muted-foreground' : ''}>
                      {task.title}
                    </span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {task.assignedAt && (
                        <span>Assigned {safeFormatDate(task.assignedAt, 'PPp')}</span>
                      )}
                      {task.completedAt && (
                        <span className="ml-2 flex items-center gap-0.5">
                          <CheckCircle className="h-3 w-3" />
                          Completed {safeFormatDate(task.completedAt, 'PPp')}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

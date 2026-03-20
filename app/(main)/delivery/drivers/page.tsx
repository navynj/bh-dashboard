'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
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
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type FixedScheduleRow = { driverId: string; dayOfWeek: number };
type DriverRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  createdAt: string;
};

type UserOption = { id: string; name: string | null; email: string | null };

export default function DeliveryDriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [fixedSchedules, setFixedSchedules] = useState<FixedScheduleRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDrivers = useCallback(async () => {
    const res = await fetch('/api/delivery/driver');
    if (!res.ok) throw new Error('Failed to load drivers');
    const data = await res.json();
    setDrivers(data);
  }, []);

  const fetchFixedSchedules = useCallback(async () => {
    const res = await fetch('/api/delivery/fixed-schedule');
    if (!res.ok) return;
    const data = await res.json();
    setFixedSchedules(data);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/user');
    if (!res.ok) return;
    const data = await res.json();
    setUsers(
      data.map(
        (u: { id: string; name: string | null; email: string | null }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        }),
      ),
    );
  }, []);

  useEffect(() => {
    Promise.all([fetchDrivers(), fetchFixedSchedules(), fetchUsers()])
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [fetchDrivers, fetchFixedSchedules, fetchUsers]);

  const handleAdd = useCallback(async () => {
    if (!addUserId) {
      toast.error('Select a user');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/delivery/driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addUserId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? res.statusText);
      }
      toast.success('Driver added');
      setAddOpen(false);
      setAddUserId('');
      await fetchDrivers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  }, [addUserId, fetchDrivers]);

  const handleDelete = useCallback(async (id: string) => {
    if (
      !confirm(
        'Remove this driver? Fixed and daily schedules will be affected.',
      )
    )
      return;
    try {
      const res = await fetch(`/api/delivery/driver/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? res.statusText);
      }
      toast.success('Driver removed');
      setDrivers((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  }, []);

  const driverUserIds = new Set(drivers.map((d) => d.userId));
  const availableUsers = users.filter((u) => !driverUserIds.has(u.id));

  const fixedByDriver = fixedSchedules.reduce(
    (acc, s) => {
      if (!acc[s.driverId]) acc[s.driverId] = [];
      acc[s.driverId].push(s.dayOfWeek);
      return acc;
    },
    {} as Record<string, number[]>,
  );

  const columns: ColumnDef<DriverRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          href={`/delivery/overview?driverId=${encodeURIComponent(row.original.id)}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name || row.original.email || row.original.id}
        </Link>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'fixedSchedule',
      header: 'Fixed schedule',
      cell: ({ row }) => {
        const driverId = row.original.id;
        const days = (fixedByDriver[driverId] ?? []).sort((a, b) => a - b);
        return (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {days.length === 0
                ? '—'
                : days.map((d) => DAY_NAMES[d]).join(', ')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              asChild
              aria-label="Edit fixed schedule"
            >
              <Link href={`/delivery/drivers/${driverId}/fixed-schedule`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => handleDelete(row.original.id)}
          aria-label="Remove driver"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (loading) {
    return <div className="py-8 text-muted-foreground">Loading drivers…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Drivers</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={availableUsers.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              Add driver
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add driver</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              Select a user to register as a driver. The user must already exist
              in the system.
            </p>
            <div>
              <Label>User</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={submitting || !addUserId}>
                {submitting ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable<DriverRow>
        columns={columns}
        data={drivers}
        isFetching={false}
      />
    </div>
  );
}

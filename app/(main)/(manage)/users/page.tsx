'use client';

import { DataTable } from '@/components/ui/data-table';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ColumnDef, type Row } from '@tanstack/react-table';
import { Check, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type UserRole = 'admin' | 'office' | 'manager' | null;
type UserStatus =
  | 'pending_onboarding'
  | 'pending_approval'
  | 'active'
  | 'rejected';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  locationId: string | null;
  location: { id: string; code: string; name: string } | null;
};

type LocationOption = { id: string; code: string; name: string };

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'office', label: 'Office' },
  { value: 'manager', label: 'Manager' },
];

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'pending_onboarding', label: 'Pending onboarding' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
];

/** Sentinel for "no location" so we never use empty string as SelectItem value. */
const NO_LOCATION_VALUE = '__none__';

async function patchUser(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/user/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error ?? res.statusText);
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/user');
    if (!res.ok) throw new Error('Failed to load users');
    const data = await res.json();
    setUsers(data);
  }, []);

  const fetchLocations = useCallback(async () => {
    const res = await fetch('/api/location');
    if (!res.ok) return;
    const data = await res.json();
    setLocations(data);
  }, []);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchLocations()])
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [fetchUsers, fetchLocations]);

  const updateUser = useCallback(
    async (row: UserRow, field: string, value: unknown) => {
      const previous = users.find((u) => u.id === row.id);
      if (!previous) return;

      const optimisticUser: UserRow = (() => {
        const next = { ...previous };
        if (field === 'name') next.name = value as string;
        else if (field === 'role') {
          next.role = value as UserRole;
          next.locationId = null;
          next.location = null;
        } else if (field === 'status') next.status = value as UserStatus;
        else if (field === 'locationId') {
          next.locationId = value as string | null;
          next.location =
            value != null
              ? locations.find((l) => l.id === value) ?? null
              : null;
        }
        return next;
      })();

      setUsers((prev) =>
        prev.map((u) => (u.id === row.id ? optimisticUser : u)),
      );

      try {
        const body: Record<string, unknown> = { [field]: value };
        if (field === 'role') {
          body.locationId = null;
        }
        await patchUser(row.id, body);
        toast.success('Updated');
      } catch (e) {
        setUsers((prev) =>
          prev.map((u) => (u.id === row.id ? previous : u)),
        );
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    },
    [users, locations],
  );

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: { row: Row<UserRow> }) => (
        <EditableName
          row={row}
          onSave={(v) => updateUser(row.original, 'name', v)}
        />
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }: { row: Row<UserRow> }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.email || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }: { row: Row<UserRow> }) => (
        <Select
          value={row.original.role ?? ''}
          onValueChange={(v) =>
            updateUser(row.original, 'role', v === '' ? null : v)
          }
        >
          <SelectTrigger className="h-8 w-[120px] border-0 bg-transparent shadow-none">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={String(o.value)} value={o.value ?? ''}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: { row: Row<UserRow> }) => (
        <Select
          value={row.original.status}
          onValueChange={(v) => updateUser(row.original, 'status', v)}
        >
          <SelectTrigger className="h-8 w-[140px] border-0 bg-transparent shadow-none">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }: { row: Row<UserRow> }) => {
        const isOfficeOrAdmin =
          row.original.role === 'office' || row.original.role === 'admin';
        const hasLocation = row.original.locationId != null;
        // Office/admin with location: enable so they can set to none only. Office/admin without: keep disabled. Manager: full list.
        const onlyAllowNone = isOfficeOrAdmin && hasLocation;
        const shouldSetLocation = !isOfficeOrAdmin && !hasLocation;
        const disabled = isOfficeOrAdmin && !hasLocation;
        return (
          <Select
            value={row.original.locationId ?? NO_LOCATION_VALUE}
            onValueChange={(v) =>
              updateUser(
                row.original,
                'locationId',
                v === NO_LOCATION_VALUE ? null : v,
              )
            }
            disabled={disabled}
          >
            <SelectTrigger
              className={cn(
                'h-8 w-[160px] border-0 bg-transparent shadow-none',
                (onlyAllowNone || shouldSetLocation) &&
                  'border-1 border-yellow-500 ring-3 ring-yellow-500/20',
              )}
            >
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              {!shouldSetLocation && (
                <SelectItem value={NO_LOCATION_VALUE}>
                  {onlyAllowNone
                    ? 'Select this option to remove location'
                    : '—'}
                </SelectItem>
              )}
              {!onlyAllowNone &&
                locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.code} – {loc.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <DataTable columns={columns} data={users} isLoading={loading} />
    </div>
  );
}

function EditableName({
  row,
  onSave,
}: {
  row: Row<UserRow>;
  onSave: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(row.original.name);
  useEffect(() => {
    setValue(row.original.name);
  }, [row.original.name]);

  const handleSave = () => {
    const v = value.trim();
    if (v !== row.original.name) onSave(v);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(row.original.name);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex justify-between w-full max-w-[280px] items-center gap-1">
        <span className="min-w-0 truncate">{row.original.name || '—'}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit name"
          className="opacity-50"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-[240px] items-center gap-1">
      <Input
        className="h-8 flex-1 min-w-0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') handleCancel();
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Save"
        onClick={handleSave}
      >
        <Check className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel"
        onClick={handleCancel}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

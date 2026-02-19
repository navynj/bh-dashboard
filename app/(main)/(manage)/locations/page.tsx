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
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { ManageRealmsDialog } from '@/components/features/locations/ManageRealmsDialog';
import { AddLocationDialog } from '@/components/features/locations/AddLocationDialog';
import { ClassName } from '@/types/className';
import { cn } from '@/lib/utils';
import { YearMonthPicker } from '@/components/ui/year-month-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { parseYearMonth } from '@/lib/utils';
import { MONTH_NAMES } from '@/constants/date';
import { getCurrentYearMonth } from '@/lib/utils';

type RealmOption = { id: string; name: string };

type LocationRow = {
  id: string;
  code: string;
  name: string;
  classId: string | null;
  realmId: string;
  realmName: string | null;
  startYearMonth: string | null;
};

async function patchLocation(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/locations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error ?? res.statusText);
  }
}

export default function LocationsPage() {
  const pathname = usePathname();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [realms, setRealms] = useState<RealmOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    const res = await fetch('/api/locations');
    if (!res.ok) throw new Error('Failed to load locations');
    const data = await res.json();
    setLocations(data);
  }, []);

  const fetchRealms = useCallback(async () => {
    const res = await fetch('/api/realms');
    if (!res.ok) return;
    const data = await res.json();
    setRealms(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    Promise.all([fetchLocations(), fetchRealms()])
      .catch(() => toast.error('Failed to load locations'))
      .finally(() => setLoading(false));
  }, [fetchLocations, fetchRealms]);

  const updateLocation = useCallback(
    async (row: LocationRow, field: string, value: unknown) => {
      const previous = locations.find((l) => l.id === row.id);
      if (!previous) return;

      const optimisticLocation: LocationRow = {
        ...previous,
        [field]: value as string | null,
        ...(field === 'realmId' && typeof value === 'string'
          ? { realmName: realms.find((r) => r.id === value)?.name ?? null }
          : {}),
        ...(field === 'startYearMonth' ? { startYearMonth: value as string | null } : {}),
      };

      setLocations((prev) =>
        prev.map((l) => (l.id === row.id ? optimisticLocation : l)),
      );

      try {
        await patchLocation(row.id, { [field]: value });
        toast.success('Updated');
      } catch (e) {
        setLocations((prev) =>
          prev.map((l) => (l.id === row.id ? previous : l)),
        );
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    },
    [locations, realms],
  );

  const columns: ColumnDef<LocationRow>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }: { row: Row<LocationRow> }) => (
        <EditableCell
          row={row}
          field="code"
          onSave={(v) => updateLocation(row.original, 'code', v)}
        />
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: { row: Row<LocationRow> }) => (
        <EditableCell
          row={row}
          field="name"
          className="max-w-full"
          onSave={(v) => updateLocation(row.original, 'name', v)}
        />
      ),
    },
    {
      accessorKey: 'realmId',
      header: 'Realm',
      cell: ({ row }: { row: Row<LocationRow> }) => (
        <RealmSelectCell
          row={row}
          realms={realms}
          onSave={(realmId) => updateLocation(row.original, 'realmId', realmId)}
        />
      ),
    },
    {
      accessorKey: 'classId',
      header: 'Class ID',
      cell: ({ row }: { row: Row<LocationRow> }) => (
        <EditableCell
          row={row}
          field="classId"
          onSave={(v) =>
            updateLocation(row.original, 'classId', v === '' ? null : v)
          }
        />
      ),
    },
    {
      accessorKey: 'startYearMonth',
      header: 'Start',
      cell: ({ row }: { row: Row<LocationRow> }) => (
        <StartYearMonthCell
          row={row}
          onSave={(v) => updateLocation(row.original, 'startYearMonth', v)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Locations</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ManageRealmsDialog
            onOpenChange={(open) => {
              if (!open) fetchRealms();
            }}
          />
          <AddLocationDialog realms={realms} onSuccess={fetchLocations} />
        </div>
      </div>
      <DataTable columns={columns} data={locations} isLoading={loading} />
    </div>
  );
}

function RealmSelectCell({
  row,
  realms,
  onSave,
}: {
  row: Row<LocationRow>;
  realms: RealmOption[];
  onSave: (realmId: string) => void;
}) {
  const realmId = row.original.realmId;
  const realmName = row.original.realmName;

  if (realms.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {realmName ?? (realmId ? `Realm` : '—')}
      </span>
    );
  }

  return (
    <Select
      value={realmId}
      onValueChange={(v) => {
        if (v && v !== realmId) onSave(v);
      }}
    >
      <SelectTrigger
        size="sm"
        className="max-w-[200px] min-w-0"
        aria-label="Select realm"
      >
        <SelectValue placeholder="Select realm" />
      </SelectTrigger>
      <SelectContent>
        {realms.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function formatStartYearMonth(ym: string): string {
  const { year, month } = parseYearMonth(ym);
  return `${MONTH_NAMES[month]} ${year}`;
}

function StartYearMonthCell({
  row,
  onSave,
}: {
  row: Row<LocationRow>;
  onSave: (value: string | null) => void;
}) {
  const value = row.original.startYearMonth;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex max-w-[140px] items-center gap-1">
          <span className="min-w-0 truncate text-sm">
            {value ? formatStartYearMonth(value) : '—'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit start month"
            className="opacity-50"
            onClick={() => setOpen(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex flex-col gap-2">
          <YearMonthPicker
            value={value ?? getCurrentYearMonth()}
            onChange={(ym) => {
              onSave(ym);
              setOpen(false);
            }}
            triggerClassName="border border-input bg-background"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSave(null);
              setOpen(false);
            }}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditableCell({
  row,
  field,
  onSave,
  className,
}: {
  row: Row<LocationRow>;
  field: 'code' | 'name' | 'classId';
  onSave: (value: string) => void;
} & ClassName) {
  const current = row.original[field] ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(current);
  useEffect(() => {
    setValue(row.original[field] ?? '');
  }, [row.original[field], field]);

  const handleSave = () => {
    const v = value.trim();
    if (field === 'classId') {
      if (v !== (row.original.classId ?? '')) onSave(v === '' ? '' : v);
    } else {
      if (v.length > 0 && v !== current) onSave(v);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(current);
    setIsEditing(false);
  };

  const displayValue = current || '—';

  if (!isEditing) {
    return (
      <div className={cn('flex max-w-[220px] items-center gap-1', className)}>
        <span className="min-w-0 truncate">{displayValue}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${field}`}
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
        placeholder={field === 'classId' ? 'Optional' : undefined}
      />
      <div className="flex">
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
    </div>
  );
}

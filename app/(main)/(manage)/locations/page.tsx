'use client';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type ColumnDef, type Row } from '@tanstack/react-table';
import { Check, Pencil } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type LocationRow = {
  id: string;
  code: string;
  name: string;
  classId: string | null;
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
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    const res = await fetch('/api/locations');
    if (!res.ok) throw new Error('Failed to load locations');
    const data = await res.json();
    setLocations(data);
  }, []);

  useEffect(() => {
    fetchLocations().catch(() => toast.error('Failed to load locations')).finally(() => setLoading(false));
  }, [fetchLocations]);

  const updateLocation = useCallback(
    async (row: LocationRow, field: string, value: unknown) => {
      try {
        await patchLocation(row.id, { [field]: value });
        await fetchLocations();
        toast.success('Updated');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    },
    [fetchLocations]
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
          onSave={(v) => updateLocation(row.original, 'name', v)}
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
          onSave={(v) => updateLocation(row.original, 'classId', v === '' ? null : v)}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Locations</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Locations</h1>
      <p className="text-muted-foreground text-sm">
        Edit code, name, and class ID inline. Changes save on blur.
      </p>
      <DataTable columns={columns} data={locations} />
    </div>
  );
}

function EditableCell({
  row,
  field,
  onSave,
}: {
  row: Row<LocationRow>;
  field: 'code' | 'name' | 'classId';
  onSave: (value: string) => void;
}) {
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
      <div className="flex max-w-[220px] items-center gap-1">
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
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Save"
        onClick={handleSave}
      >
        <Check className="size-3.5" />
      </Button>
    </div>
  );
}

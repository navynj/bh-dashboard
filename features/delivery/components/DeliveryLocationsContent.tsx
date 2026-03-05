'use client';

import { useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import type { DeliveryLocationRow, LocationOption } from '@/features/delivery/types/locations';
import { useDeliveryLocations } from '@/features/delivery/hooks/useDeliveryLocations';
import { useConfirmDialog } from '@/features/delivery/hooks/useConfirmDialog';
import { AddDeliveryLocationDialog } from './AddDeliveryLocationDialog';
import { EditableCell } from './EditableCell';

type DeliveryLocationsContentProps = {
  locations: DeliveryLocationRow[];
  locationOptions: LocationOption[];
};

export function DeliveryLocationsContent({
  locations: initialLocations,
  locationOptions,
}: DeliveryLocationsContentProps) {
  const confirmDialog = useConfirmDialog();
  const {
    locations,
    locationOptions: options,
    updateLocation,
    deleteById,
    editId,
    editForm,
    setEditForm,
    setEditId,
    openEdit,
    saveEdit,
    refresh,
  } = useDeliveryLocations({ initialLocations, locationOptions });

  const handleDelete = useCallback(
    (row: DeliveryLocationRow) => {
      confirmDialog.openConfirm({
        title: 'Delete delivery location',
        description: `Delete "${row.name}"? This cannot be undone.`,
        variant: 'destructive',
        confirmLabel: 'Delete',
        onConfirm: () => deleteById(row.id),
      });
    },
    [confirmDialog, deleteById],
  );

  const columns: ColumnDef<DeliveryLocationRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <EditableCell
          row={row}
          field="name"
          onSave={(v) => updateLocation(row.original, 'name', v ?? '')}
        />
      ),
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => (
        <EditableCell
          row={row}
          field="address"
          onSave={(v) => updateLocation(row.original, 'address', v)}
          placeholder="—"
          className="max-w-[280px]"
        />
      ),
    },
    {
      accessorKey: 'lat',
      header: 'Lat',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.lat != null ? row.original.lat : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'lng',
      header: 'Lng',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.lng != null ? row.original.lng : '—'}
        </span>
      ),
    },
    {
      id: 'locationLink',
      header: 'Linked location',
      cell: ({ row }) => {
        const locId = row.original.locationId;
        return (
          <Select
            value={locId ?? '__none__'}
            onValueChange={(v) =>
              updateLocation(
                row.original,
                'locationId',
                v === '__none__' ? null : v,
              )
            }
          >
            <SelectTrigger className="max-w-[180px]">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.code} – {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEdit(row.original)}
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => handleDelete(row.original)}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const editingRow = editId ? locations.find((l) => l.id === editId) : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Delivery locations</h1>
        <AddDeliveryLocationDialog
          locationOptions={locationOptions}
          onSuccess={refresh}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        Main locations for everyday schedule. You can link to a main Location
        (DB) for future inventory. Occasional one-time locations can be added
        when building a daily schedule.
      </p>
      <DataTable<DeliveryLocationRow>
        columns={columns}
        data={locations}
        isFetching={false}
      />

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit delivery location</DialogTitle>
          </DialogHeader>
          {editingRow && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editForm.name ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={editForm.address ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Latitude</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={editForm.lat ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        lat: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={editForm.lng ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        lng: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>
              </div>
              {options.length > 0 && (
                <div>
                  <Label>Link to main location</Label>
                  <Select
                    value={editForm.locationId ?? '__none__'}
                    onValueChange={(v) =>
                      setEditForm((f) => ({
                        ...f,
                        locationId: v === '__none__' ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {options.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.code} – {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditId(null)}>
                  Cancel
                </Button>
                <Button onClick={saveEdit}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

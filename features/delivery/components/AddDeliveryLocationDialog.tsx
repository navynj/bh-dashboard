'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

type LocationOption = { id: string; code: string; name: string };

type AddDeliveryLocationDialogProps = {
  locationOptions: LocationOption[];
  onSuccess?: () => void;
};

const defaultForm = {
  name: '',
  address: '',
  lat: '' as string | number,
  lng: '' as string | number,
  locationId: '' as string | '',
};

export function AddDeliveryLocationDialog({
  locationOptions,
  onSuccess,
}: AddDeliveryLocationDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const reset = useCallback(() => {
    setForm(defaultForm);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      setOpen(next);
    },
    [reset],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.name.trim()) {
        toast.error('Name is required');
        return;
      }
      setSubmitting(true);
      try {
        const body: {
          name: string;
          address?: string;
          lat?: number;
          lng?: number;
          locationId?: string | null;
        } = {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
        };
        const numLat = typeof form.lat === 'string' ? parseFloat(form.lat) : form.lat;
        const numLng = typeof form.lng === 'string' ? parseFloat(form.lng) : form.lng;
        if (numLat != null && !Number.isNaN(numLat)) body.lat = numLat;
        if (numLng != null && !Number.isNaN(numLng)) body.lng = numLng;
        if (form.locationId) body.locationId = form.locationId;

        const res = await fetch('/api/delivery/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error ?? res.statusText);
        }
        toast.success('Delivery location added');
        setOpen(false);
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add');
      } finally {
        setSubmitting(false);
      }
    },
    [form, onSuccess],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add location
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add delivery location</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dl-name">Name</Label>
            <Input
              id="dl-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Location name"
              required
            />
          </div>
          <div>
            <Label htmlFor="dl-address">Address</Label>
            <Input
              id="dl-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Full address"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="dl-lat">Latitude</Label>
              <Input
                id="dl-lat"
                type="text"
                inputMode="decimal"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="e.g. 37.5"
              />
            </div>
            <div>
              <Label htmlFor="dl-lng">Longitude</Label>
              <Input
                id="dl-lng"
                type="text"
                inputMode="decimal"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="e.g. 127.0"
              />
            </div>
          </div>
          {locationOptions.length > 0 && (
            <div>
              <Label>Link to main location (optional)</Label>
              <Select
                value={form.locationId || '__none__'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, locationId: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} – {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ManageRealmsDialog } from './ManageRealmsDialog';
import { YearMonthPicker } from '@/components/ui/year-month-picker';
import { getCurrentYearMonth } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export type RealmOption = { id: string; name: string };

type AddLocationDialogProps = {
  realms: RealmOption[];
  onSuccess?: () => void;
};

const defaultForm = {
  code: '',
  name: '',
  realmId: '',
  classId: '',
  startYearMonth: null as string | null,
  showBudget: true,
};

export function AddLocationDialog({
  realms,
  onSuccess,
}: AddLocationDialogProps) {
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
      if (!form.code.trim() || !form.name.trim() || !form.realmId) {
        toast.error('Code, name, and realm are required');
        return;
      }
      if (realms.length === 0) {
        toast.error(
          'No realms available. Create a realm first in Manage Realms.',
        );
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: form.code.trim(),
            name: form.name.trim(),
            realmId: form.realmId,
            classId: form.classId.trim() || null,
            startYearMonth: form.startYearMonth ?? null,
            showBudget: form.showBudget,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to create location');
        }
        toast.success('Location added');
        handleOpenChange(false);
        onSuccess?.();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Failed to create location',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [form, realms.length, handleOpenChange, onSuccess],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">Add Location</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="add-location-code">Code</Label>
            <Input
              id="add-location-code"
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, code: e.target.value }))
              }
              placeholder="e.g. HQ"
              required
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-location-name">Name</Label>
            <Input
              id="add-location-name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. Headquarters"
              required
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Realm</Label>
              <ManageRealmsDialog
                trigger={
                  <Button variant="ghost" size="icon-sm">
                    <Settings className="size-3.5" />
                  </Button>
                }
              />
            </div>
            <Select
              value={form.realmId}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, realmId: v }))
              }
            >
              <SelectTrigger
                id="add-location-realm"
                aria-label="Select realm"
                className="w-full"
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-location-classid">Class ID (optional)</Label>
            <Input
              id="add-location-classid"
              value={form.classId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, classId: e.target.value }))
              }
              placeholder="QuickBooks class ID"
              autoComplete="off"
            />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <div>
              <Label htmlFor="add-location-show-budget" className="text-sm">
                Show in Budget
              </Label>
              <p className="text-muted-foreground text-xs mt-0.5">
                Include this location in budget views and calculations.
              </p>
            </div>
            <Switch
              id="add-location-show-budget"
              checked={form.showBudget}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, showBudget: checked }))
              }
              aria-label="Show in budget"
            />
          </div>
          <div className="grid gap-2 p-4 rounded-lg border">
            <Label>Start month (optional)</Label>
            <div className="flex items-center gap-2">
              <YearMonthPicker
                value={form.startYearMonth ?? getCurrentYearMonth()}
                onChange={(ym) =>
                  setForm((prev) => ({ ...prev, startYearMonth: ym }))
                }
                triggerClassName="border border-input bg-background"
              />
              {form.startYearMonth != null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, startYearMonth: null }))
                  }
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Budgets are only created from this month onward. Leave unset for
              all months.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Location'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

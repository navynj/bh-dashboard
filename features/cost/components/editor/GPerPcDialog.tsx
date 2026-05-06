'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { calculateGPriceFromUnitPrice } from '@/lib/shopify/calculations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string;
  productTitle: string;
  unit: string;
  unitPrice: number | null;
  currentGPerPc?: number | null;
  /** Called after a successful save so the parent can update local state */
  onSaved: (gPerPc: number, newGPrice: number) => void;
}

export default function GPerPcDialog({
  open,
  onOpenChange,
  variantId,
  productTitle,
  unit,
  unitPrice,
  currentGPerPc,
  onSaved,
}: Props) {
  const t = useTranslations('Cost');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentGPerPc ? currentGPerPc.toString() : '');
      setError(null);
    }
  }, [open, currentGPerPc]);

  const parsed = parseFloat(value);
  const preview = !isNaN(parsed) && parsed > 0 && unitPrice != null
    ? calculateGPriceFromUnitPrice(unitPrice, unit, { g_per_pc: parsed })
    : null;

  async function handleSave() {
    if (isNaN(parsed) || parsed <= 0) {
      setError(t('gPerPcRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/cost/ingredient-gperpc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, gPerPc: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      const newGPrice = preview;
      onSaved(parsed, newGPrice ?? 0);
      toast.success(t('gPerPcSaved'));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('setGPerPc')}</DialogTitle>
          <DialogDescription>
            {productTitle} — {t('gPerPcDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gperpc-input">{t('gPerPc')} (g)</Label>
            <Input
              id="gperpc-input"
              type="number"
              min={0.01}
              step="0.01"
              placeholder="0"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              disabled={saving}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {preview != null && (
            <p className="text-xs text-muted-foreground">
              {t('gPrice')}: <span className="font-medium text-foreground">${preview.toFixed(4)}/g</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !value}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('saveCost')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

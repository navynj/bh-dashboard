'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface GPerPcDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue?: number | null;
  productTitle?: string;
  onSave: (value: number) => Promise<void>;
}

const GPerPcDialog = ({
  open,
  onOpenChange,
  currentValue,
  productTitle,
  onSave,
}: GPerPcDialogProps) => {
  const t = useTranslations();
  const [value, setValue] = useState<string>(currentValue?.toString() || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Value must be greater than 0');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await onSave(numValue);
      onOpenChange(false);
      setValue('');
    } catch (error) {
      console.error('Failed to save g_per_pc:', error);
      setError((error as Error)?.message || t('UI.failed') || 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setValue('');
    }
    onOpenChange(newOpen);
  };

  // Update value when currentValue changes and dialog opens
  useEffect(() => {
    if (open) {
      setValue(currentValue?.toString() || '');
      setError(null);
    }
  }, [open, currentValue]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Cost.setGPerPc')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {productTitle
            ? `${productTitle} - ${t('Cost.gPerPcDescription')}`
            : t('Cost.gPerPcDescription')}
        </DialogDescription>
        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              id="g-per-pc"
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder="0"
              disabled={isLoading}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
        <DialogFooter className="flex flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {t('UI.cancel')}
          </Button>
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isLoading || !value}
          >
            {t('UI.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GPerPcDialog;

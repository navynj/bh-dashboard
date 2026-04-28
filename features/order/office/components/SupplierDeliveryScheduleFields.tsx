'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import {
  ISO_WEEKDAY_OPTIONS,
  type SupplierDeliveryScheduleForm,
} from '../hooks/use-supplier-delivery-schedule-form';

type Props = {
  form: SupplierDeliveryScheduleForm;
  /** Unique `name` for radio inputs (avoid clashes when multiple forms exist). */
  radioName: string;
  intro?: ReactNode;
};

export function SupplierDeliveryScheduleFields({
  form,
  radioName,
  intro,
}: Props) {
  const {
    deliveryRuleKind,
    deliveryWeekdays,
    partitionWindows,
    selectOff,
    selectNext,
    selectDayAfterCreation,
    selectPartition,
    toggleDeliveryWeekday,
    patchPartitionWindow,
    togglePartitionOrderDay,
    addPartitionWindow,
    removePartitionWindow,
    applyBhSplitTemplate,
  } = form;

  return (
    <div className="grid gap-2 rounded-md border border-border/60 p-2.5">
      <Label className="text-xs">PO default — expected delivery</Label>
      {intro ?? (
        <p className="text-[10px] text-muted-foreground -mt-0.5">
          Used in the inbox when creating a PO (reference = latest order date in
          the row, or today). BH split is only a template — partition rows are
          saved on this supplier.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="radio"
            name={radioName}
            className="h-3 w-3"
            checked={deliveryRuleKind === 'off'}
            onChange={selectOff}
          />
          Off (no schedule)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="radio"
            name={radioName}
            className="h-3 w-3"
            checked={deliveryRuleKind === 'next'}
            onChange={selectNext}
          />
          Next delivery day after reference (pick weekdays below)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="radio"
            name={radioName}
            className="h-3 w-3"
            checked={deliveryRuleKind === 'day_after_creation'}
            onChange={selectDayAfterCreation}
          />
          Day after PO is created (Vancouver calendar)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="radio"
            name={radioName}
            className="h-3 w-3"
            checked={deliveryRuleKind === 'partition'}
            onChange={selectPartition}
          />
          Weekly partitions (ISO weeks)
        </label>
      </div>
      {deliveryRuleKind === 'next' && (
        <div className="flex flex-wrap gap-1 pt-1">
          {ISO_WEEKDAY_OPTIONS.map(({ value, label }) => {
            const on = deliveryWeekdays.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDeliveryWeekday(value)}
                className={cn(
                  'rounded border px-2 py-0.5 text-[10px] font-medium transition-colors',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {deliveryRuleKind === 'partition' && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={applyBhSplitTemplate}
            >
              Apply BH split template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={addPartitionWindow}
            >
              Add window
            </Button>
          </div>
          {partitionWindows.map((win, wi) => (
            <div
              key={wi}
              className="rounded border border-border/70 bg-muted/20 p-2 space-y-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  Window {wi + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-1.5 text-destructive"
                  disabled={partitionWindows.length <= 1}
                  onClick={() => removePartitionWindow(wi)}
                >
                  Remove
                </Button>
              </div>
              <div>
                <span className="text-[9px] uppercase text-muted-foreground block mb-1">
                  Order placed on (ISO weekday)
                </span>
                <div className="flex flex-wrap gap-1">
                  {ISO_WEEKDAY_OPTIONS.map(({ value, label }) => {
                    const on = win.orderWeekdays.includes(value);
                    const takenElsewhere = partitionWindows.some(
                      (w, j) => j !== wi && w.orderWeekdays.includes(value),
                    );
                    const disabled = !on && takenElsewhere;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (!disabled) togglePartitionOrderDay(wi, value);
                        }}
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[9px] font-medium transition-colors',
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : disabled
                              ? 'cursor-not-allowed border-border bg-muted/30 text-muted-foreground/50'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-[9px] text-muted-foreground">
                    Deliver on
                  </Label>
                  <Select
                    value={String(win.deliverWeekday)}
                    onValueChange={(v) =>
                      patchPartitionWindow(wi, {
                        deliverWeekday: Number(v),
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-[10px] px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISO_WEEKDAY_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={String(value)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[9px] text-muted-foreground">Week</Label>
                  <Select
                    value={win.deliverIn}
                    onValueChange={(v) =>
                      patchPartitionWindow(wi, {
                        deliverIn: v as 'same_iso_week' | 'next_iso_week',
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-[10px] px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same_iso_week">This ISO week</SelectItem>
                      <SelectItem value="next_iso_week">Next ISO week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { YearMonthPicker } from '@/components/ui/year-month-picker';
import { toast } from 'sonner';
import { formatYearMonth, getCurrentYearMonth } from '@/lib/utils';
import { usePathname } from 'next/navigation';

const CURRENT_YEAR = new Date().getFullYear();
const BULK_EDIT_YEARS = Array.from(
  { length: 24 },
  (_, i) => CURRENT_YEAR - 10 + i,
);
const EARLIEST_YEAR_MONTH = formatYearMonth(CURRENT_YEAR - 10, 0);

export function BudgetBulkEditDialog() {
  const pathname = usePathname();
  const isLocationPage = pathname.includes('/budget/location');
  if (isLocationPage) return null;

  const currentYearMonth = getCurrentYearMonth();
  const [open, setOpen] = useState(false);
  const [selectAllPeriod, setSelectAllPeriod] = useState(false);
  const [fromYearMonth, setFromYearMonth] = useState(currentYearMonth);
  const [toYearMonth, setToYearMonth] = useState(currentYearMonth);
  const [rate, setRate] = useState('');
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    yearMonth: string;
    locationCode: string;
    locationName: string;
    updated: number;
  } | null>(null);

  const rangeValid = selectAllPeriod || fromYearMonth <= toYearMonth;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeValid) {
      toast.error('From month must be before or equal to To month');
      return;
    }
    toast.dismiss();
    setLoading(true);
    setProgress(null);
    try {
      const body: {
        fromYearMonth: string;
        toYearMonth: string;
        budgetRate?: number;
        referencePeriodMonths?: number;
      } = {
        fromYearMonth: selectAllPeriod ? EARLIEST_YEAR_MONTH : fromYearMonth,
        toYearMonth: selectAllPeriod ? getCurrentYearMonth() : toYearMonth,
      };
      const rateNum = rate.trim() ? Number(rate) : undefined;
      if (rateNum !== undefined && (rateNum < 0 || rateNum > 100)) {
        toast.error('Rate must be between 0 and 100');
        setLoading(false);
        return;
      }
      if (rateNum !== undefined) body.budgetRate = rateNum / 100;
      const periodNum = period.trim() ? Number(period) : undefined;
      if (
        periodNum !== undefined &&
        (periodNum < 1 || periodNum > 24 || !Number.isInteger(periodNum))
      ) {
        toast.error('Reference period must be between 1 and 24 (whole number)');
        setLoading(false);
        return;
      }
      if (periodNum !== undefined) body.referencePeriodMonths = periodNum;

      const res = await fetch('/api/budget/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Bulk update failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalUpdated = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as
              | {
                  type: 'progress';
                  yearMonth: string;
                  locationCode: string;
                  locationName: string;
                  updated: number;
                }
              | { type: 'done'; updated: number }
              | { type: 'error'; error: string };
            if (msg.type === 'progress') {
              setProgress({
                yearMonth: msg.yearMonth,
                locationCode: msg.locationCode,
                locationName: msg.locationName,
                updated: msg.updated,
              });
            } else if (msg.type === 'done') {
              finalUpdated = msg.updated;
            } else if (msg.type === 'error') {
              throw new Error(msg.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      if (buffer.trim()) {
        const msg = JSON.parse(buffer) as {
          type: string;
          updated?: number;
          error?: string;
        };
        if (msg.type === 'done') finalUpdated = msg.updated ?? 0;
        if (msg.type === 'error')
          throw new Error(msg.error ?? 'Bulk update failed');
      }

      toast.success(`Updated ${finalUpdated} budget(s)`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk update failed');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Bulk edit budgets">
          <NotebookPen className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Budget Bulk Edit</DialogTitle>
        {loading && (
          <div
            className="absolute inset-x-0 top-0 h-1 rounded-t-lg overflow-hidden bg-muted"
            role="progressbar"
            aria-valuenow={undefined}
            aria-label="Updating budgets"
          >
            <div
              className="h-full w-1/4 min-w-[4rem] bg-primary rounded-full"
              style={{
                animation: 'progress-indeterminate 1.5s ease-in-out infinite',
              }}
            />
          </div>
        )}
        <form
          onSubmit={submit}
          onKeyDown={submitOnEnter}
          className="flex flex-col gap-6"
          aria-busy={loading}
        >
          <fieldset className="contents" disabled={loading}>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <FieldLabel className="text-xs">Period</FieldLabel>
                <div className="flex gap-2 justify-between items-center">
                  <Field className="flex flex-row items-center gap-2 w-fit">
                    <FieldLabel
                      htmlFor="bulk-select-all-period"
                      className="cursor-pointer font-normal text-[0.625rem] text-muted-foreground"
                    >
                      Select all period
                    </FieldLabel>
                    <Switch
                      id="bulk-select-all-period"
                      checked={selectAllPeriod}
                      onCheckedChange={setSelectAllPeriod}
                    />
                  </Field>
                </div>
              </div>
              {!selectAllPeriod && (
                <div className="w-full flex items-center gap-4 bg-accent rounded-md p-2">
                  <Field className="gap-1">
                    <FieldLabel
                      htmlFor="bulk-from-year-month"
                      className="sr-only"
                    >
                      From
                    </FieldLabel>
                    <YearMonthPicker
                      value={fromYearMonth}
                      onChange={setFromYearMonth}
                      years={BULK_EDIT_YEARS}
                      triggerClassName="min-w-0 bg-white hover:bg-white/75 hover:shadow-sm text-sm"
                    />
                  </Field>
                  <span>~</span>
                  <Field className="gap-1">
                    <FieldLabel
                      htmlFor="bulk-to-year-month"
                      className="sr-only"
                    >
                      To
                    </FieldLabel>
                    <YearMonthPicker
                      value={toYearMonth}
                      onChange={setToYearMonth}
                      years={BULK_EDIT_YEARS}
                      triggerClassName="min-w-0 bg-white hover:bg-white/75 hover:shadow-sm text-sm"
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field className="gap-1">
                <FieldLabel htmlFor="bulk-rate" className="text-xs">
                  Budget rate (%)
                </FieldLabel>
                <Input
                  id="bulk-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="Leave empty to keep current"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="placeholder:text-xs"
                />
              </Field>
              <Field className="gap-1">
                <FieldLabel htmlFor="bulk-period" className="text-xs">
                  Reference period (months)
                </FieldLabel>
                <Input
                  id="bulk-period"
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  placeholder="Leave empty to keep current"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="placeholder:text-xs"
                />
              </Field>
            </div>

            <Button type="submit" disabled={loading || !rangeValid}>
              {loading ? (
                <>
                  <Spinner />
                  {progress && (
                    <p className="text-xs pl-6">
                      {progress.locationName
                        ? `${progress.locationName} (${progress.locationCode})`
                        : progress.locationCode}
                      {' · '}
                      {progress.yearMonth}
                      {' · '}
                      <span className="font-medium">
                        {progress.updated}
                      </span>{' '}
                      updated
                    </p>
                  )}
                </>
              ) : (
                'Update budgets'
              )}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

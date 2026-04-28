'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { YmdDateInput } from '@/components/ui/ymd-date-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';
import type { Period, PeriodKey } from '../types';
import { formatOfficeDateChip } from '../utils/format-date-label';

export type FilterDropdownOption = { value: string; label: string };
export type SupplierGroupFilterOption = { slug: string; name: string };

type Props = {
  periods: Period[];
  /** Extra presets (e.g. older expected dates) — chosen via “More” dialog. */
  morePeriods?: Period[];
  activePeriod: PeriodKey;
  onPeriodChange: (id: PeriodKey) => void;
  onCustomApply: (from: string, to: string) => void;
  dateLabel?: string;
  /**
   * Archived view: no preset chips — only the date label + custom range + Apply
   * (filter by Shopify order / `latestOrderedAt` date).
   */
  orderedDateOnly?: boolean;
  /** When `orderedDateOnly`, controls inputs from parent (syncs with Clear). */
  archiveFrom?: string;
  archiveTo?: string;
  onArchiveFromChange?: (v: string) => void;
  onArchiveToChange?: (v: string) => void;
  /** When provided, the dateLabel becomes a dropdown instead of plain text. */
  dateModeOptions?: FilterDropdownOption[];
  dateMode?: string;
  onDateModeChange?: (v: string) => void;
  /** Supplier group filter (`supplier_groups.slug`); always rendered when not `orderedDateOnly`. */
  supplierGroupOptions?: SupplierGroupFilterOption[];
  activeSupplierGroupSlug?: string | null;
  onSupplierGroupChange?: (slug: string | null) => void;
};

export function PeriodFilterBar({
  periods,
  morePeriods = [],
  activePeriod,
  onPeriodChange,
  onCustomApply,
  dateLabel = 'Period',
  orderedDateOnly = false,
  archiveFrom,
  archiveTo,
  onArchiveFromChange,
  onArchiveToChange,
  dateModeOptions,
  dateMode,
  onDateModeChange,
  supplierGroupOptions = [],
  activeSupplierGroupSlug,
  onSupplierGroupChange,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(orderedDateOnly ? '' : today);
  const [to, setTo] = useState(orderedDateOnly ? '' : today);
  const af =
    orderedDateOnly && onArchiveFromChange ? (archiveFrom ?? '') : from;
  const at = orderedDateOnly && onArchiveToChange ? (archiveTo ?? '') : to;
  const setAf = onArchiveFromChange ?? setFrom;
  const setAt = onArchiveToChange ?? setTo;
  const [moreOpen, setMoreOpen] = useState(false);

  const allPresetLabels = useMemo(
    () => [...periods, ...morePeriods],
    [periods, morePeriods],
  );

  const activeInMore = morePeriods.some((p) => p.id === activePeriod);

  const activeLabel =
    activePeriod === 'custom'
      ? af && at
        ? `${formatOfficeDateChip(af)} – ${formatOfficeDateChip(at)}`
        : `${af || '?'} – ${at || '?'}`
      : activePeriod === 'all'
        ? ''
        : (allPresetLabels.find((p) => p.id === activePeriod)?.label ?? '');

  if (orderedDateOnly) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 py-[7px] border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            Supplier group
          </span>
          <select
            value={activeSupplierGroupSlug ?? ''}
            onChange={(e) => onSupplierGroupChange?.(e.target.value || null)}
            className="text-[11px] h-[22px] px-1.5 rounded-[5px] border border-border bg-background text-foreground cursor-pointer"
          >
            <option value="">All</option>
            {supplierGroupOptions.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="h-4 w-px bg-border flex-shrink-0 self-center" />
        <span className="flex-shrink-0 text-[11px] font-medium text-foreground">
          {dateLabel}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <YmdDateInput
            value={af}
            onChange={(e) => setAf(e.target.value)}
            className="h-auto min-h-0 w-auto text-[11px] px-1.5 py-[3px] rounded-[5px] md:text-[11px]"
          />
          <span className="text-[10px] text-muted-foreground">–</span>
          <YmdDateInput
            value={at}
            onChange={(e) => setAt(e.target.value)}
            className="h-auto min-h-0 w-auto text-[11px] px-1.5 py-[3px] rounded-[5px] md:text-[11px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCustomApply(af, at)}
            className="h-auto min-h-0 text-[11px] px-2 py-[3px] rounded-[5px] font-normal"
          >
            Apply
          </Button>
        </div>
        {activePeriod === 'custom' && (
          <div className="ml-auto flex flex-shrink-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>
              Showing:{' '}
              <strong className="text-foreground">{activeLabel}</strong>
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => onPeriodChange('all')}
              className="h-auto min-h-0 p-0 text-[11px] font-normal underline underline-offset-2"
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-5 py-[7px] border-b bg-background flex-shrink-0">
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">
          Supplier group
        </span>
        <select
          value={activeSupplierGroupSlug ?? ''}
          onChange={(e) => onSupplierGroupChange?.(e.target.value || null)}
          className="text-[11px] h-[22px] px-1.5 rounded-[5px] border border-border bg-background text-foreground cursor-pointer"
        >
          <option value="">All</option>
          {supplierGroupOptions.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="h-4 w-px bg-border flex-shrink-0 self-center" />

      {dateModeOptions && dateModeOptions.length >= 2 ? (
        <select
          value={dateMode ?? ''}
          onChange={(e) => onDateModeChange?.(e.target.value)}
          className="flex-shrink-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wide h-[22px] px-1.5 rounded-[5px] border border-border bg-background cursor-pointer mr-0.5"
        >
          {dateModeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="flex-shrink-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wide mr-0.5">
          {dateLabel}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-wrap gap-1 items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPeriodChange('all')}
          className={cn(
            'h-auto min-h-0 text-[11px] px-2.5 py-[3px] rounded-[5px] font-normal',
            activePeriod === 'all' &&
              'bg-foreground text-background border-transparent hover:bg-foreground/90 hover:text-background',
            activePeriod !== 'all' &&
              'border-border text-muted-foreground bg-background hover:bg-muted',
          )}
        >
          All
        </Button>
        {periods.map((p) => {
          const isOn = activePeriod === p.id;
          return (
            <Button
              key={p.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPeriodChange(p.id)}
              className={cn(
                'h-auto min-h-0 text-[11px] px-2.5 py-[3px] rounded-[5px] font-normal',
                isOn &&
                  'bg-foreground text-background border-transparent hover:bg-foreground/90 hover:text-background',
                !isOn &&
                  'border-border text-muted-foreground bg-background hover:bg-muted',
              )}
            >
              {p.label}
            </Button>
          );
        })}
        {morePeriods.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'h-auto min-h-0 text-[11px] px-2.5 py-[3px] rounded-[5px] font-normal',
              activeInMore &&
                'bg-foreground text-background border-transparent hover:bg-foreground/90 hover:text-background',
              !activeInMore &&
                'border-border text-muted-foreground bg-background hover:bg-muted',
            )}
          >
            More…
          </Button>
        )}
      </div>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:max-w-md max-h-[min(480px,85vh)] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <DialogTitle className="text-sm">{dateLabel} dates</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-3 py-2 flex flex-col gap-1 max-h-[min(400px,70vh)]">
            {morePeriods.map((p) => {
              const isOn = activePeriod === p.id;
              return (
                <Button
                  key={p.id}
                  type="button"
                  variant={isOn ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start text-[11px] h-auto min-h-8 py-1.5 font-normal',
                    isOn &&
                      'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                  )}
                  onClick={() => {
                    onPeriodChange(p.id);
                    setMoreOpen(false);
                  }}
                >
                  {p.label}
                  <span className="ml-2 text-muted-foreground text-[10px]">
                    {p.from === p.to
                      ? formatOfficeDateChip(p.from)
                      : `${formatOfficeDateChip(p.from)} – ${formatOfficeDateChip(p.to)}`}
                  </span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-4 w-px bg-border mx-1 flex-shrink-0 self-center" />

      <div className="flex flex-shrink-0 items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Custom</span>
        <YmdDateInput
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-auto min-h-0 w-auto min-w-[10.5rem] text-[11px] px-1.5 py-[3px] rounded-[5px] md:text-[11px]"
        />
        <span className="text-[10px] text-muted-foreground">–</span>
        <YmdDateInput
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-auto min-h-0 w-auto min-w-[10.5rem] text-[11px] px-1.5 py-[3px] rounded-[5px] md:text-[11px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCustomApply(from, to)}
          className="h-auto min-h-0 text-[11px] px-2 py-[3px] rounded-[5px] font-normal"
        >
          Apply
        </Button>
      </div>

      {activePeriod !== 'all' && (
        <div className="ml-auto flex flex-shrink-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>
            Showing: <strong className="text-foreground">{activeLabel}</strong>
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => onPeriodChange('all')}
            className="h-auto min-h-0 p-0 text-[11px] font-normal underline underline-offset-2"
          >
            Show all
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SearchableSelectOption = { id: string; label: string };

export type SearchableSelectProps = {
  id?: string;
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (next: string) => void;
  /** Label for the empty value row and trigger when nothing is selected */
  allLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Popover panel width; defaults to match trigger via Radix CSS var */
  contentClassName?: string;
};

export function SearchableSelect({
  id,
  options,
  value,
  onValueChange,
  allLabel = 'All',
  searchPlaceholder = 'Search…',
  disabled,
  className,
  contentClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const displayLabel = useMemo(() => {
    if (!value) return allLabel;
    return options.find((o) => o.id === value)?.label ?? value;
  }, [value, options, allLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const pick = (next: string) => {
    onValueChange(next);
    handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-9 max-w-full min-w-0 w-full justify-between gap-1 rounded-md border border-input bg-white px-2 text-sm font-normal shadow-xs hover:bg-white dark:bg-input/30 dark:hover:bg-input/30',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="min-w-0 truncate text-left">{displayLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'min-w-[9rem] w-[var(--radix-popover-trigger-width)] p-2',
          contentClassName,
        )}
        align="start"
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="mb-2 h-8 text-sm"
        />
        <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted/60"
            onClick={() => pick('')}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              {!value ? (
                <Check className="size-4 text-primary" />
              ) : (
                <span className="size-4" />
              )}
            </span>
            <span className="min-w-0 truncate">{allLabel}</span>
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No matches
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                onClick={() => pick(o.id)}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {value === o.id ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <span className="size-4" />
                  )}
                </span>
                <span className="min-w-0 truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

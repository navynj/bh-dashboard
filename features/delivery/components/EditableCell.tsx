'use client';

import { useCallback, useEffect, useState } from 'react';
import { type Row } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DeliveryLocationRow } from '@/features/delivery/types/locations';

type EditableCellProps = {
  row: Row<DeliveryLocationRow>;
  field: keyof DeliveryLocationRow;
  onSave: (value: string | null) => void;
  placeholder?: string;
  className?: string;
};

export function EditableCell({
  row,
  field,
  onSave,
  placeholder,
  className,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.original[field] ?? ''));
  const v = row.original[field];

  useEffect(() => {
    setValue(String(v ?? ''));
  }, [v]);

  const handleBlur = useCallback(() => {
    const trimmed = value.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next !== (v ?? null)) onSave(next);
    setEditing(false);
  }, [value, v, onSave]);

  if (editing) {
    return (
      <Input
        className={className ?? 'h-8 max-w-[200px]'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) =>
          e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()
        }
        autoFocus
      />
    );
  }
  return (
    <button
      type="button"
      className={cn(
        'text-left min-w-0 truncate max-w-[200px] block border border-transparent hover:border-input rounded px-2 py-1',
        className,
      )}
      onClick={() => setEditing(true)}
    >
      {(row.original[field] as string | null) ?? placeholder ?? '—'}
    </button>
  );
}

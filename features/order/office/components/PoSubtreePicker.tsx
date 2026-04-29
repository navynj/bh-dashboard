'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { PoTable } from './PoTable';
import type { OfficePurchaseOrderBlock } from '../types';

type Props = {
  parentLabel: string;
  purchaseOrders: OfficePurchaseOrderBlock[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function PoSubtreePicker({
  parentLabel,
  purchaseOrders,
  selectedId,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(true);
  const selected =
    purchaseOrders.find((b) => b.id === selectedId) ?? purchaseOrders[0];

  return (
    <div className="space-y-2.5">
      <div className="bg-background border border-border rounded-[10px] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3.5 py-2 text-left border-b bg-muted/40 hover:bg-muted/55"
        >
          <span
            className={cn(
              'text-[9px] text-muted-foreground transition-transform duration-150 flex-shrink-0 w-[10px]',
              open && 'rotate-90',
            )}
          >
            ▶
          </span>
          <span className="text-[12px] font-medium text-foreground">{parentLabel}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {purchaseOrders.length} PO{purchaseOrders.length !== 1 ? 's' : ''}
          </span>
        </button>

        {open && (
          <div className="py-0.5">
            {purchaseOrders.map((po) => {
              const label = po.subtreeRowLabel ?? po.title;
              const on = po.id === selectedId;
              return (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => onSelect(po.id)}
                  className={cn(
                    'flex w-full items-center gap-2 pl-8 pr-3.5 py-[7px] text-left text-[11px] border-b border-border/60 last:border-b-0',
                    on
                      ? 'bg-[#EBF4FD] text-[#0C447C] font-medium'
                      : 'text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <PoTable purchaseOrder={selected} lineItemsLoading={false} />
      )}
    </div>
  );
}

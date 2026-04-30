'use client';

import { PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { OfficePendingOrderAlertItem } from '../utils/collect-office-pending-order-alerts';

type Props = {
  items: OfficePendingOrderAlertItem[];
  /** Focus supplier + PO on the PO Pending tab. */
  onNavigateToPendingPo: (item: OfficePendingOrderAlertItem) => void;
};

/**
 * Persistent banner for hub POs in `pending` status (PO Pending tab).
 * Layout mirrors {@link PoEmailDeliveryAlertsStrip}; styling is amber.
 */
export function OfficePendingOrdersAlertsStrip({
  items,
  onNavigateToPendingPo,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex-shrink-0 border-b border-border" role="region">
      <div
        className={cn(
          'px-3 py-2 border-b border-amber-300/60',
          'bg-amber-50 dark:bg-amber-950/35 dark:border-amber-800/60',
        )}
        aria-label="Purchase orders on hold (pending status)"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <PauseCircle
            className="size-3.5 shrink-0 text-amber-800 dark:text-amber-200"
            aria-hidden
          />
          <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">
            Pending POs ({items.length})
          </p>
        </div>
        <ul className="flex flex-col gap-1.5 max-h-[min(40vh,220px)] overflow-y-auto pr-0.5">
          {items.map((it) => (
            <li key={it.purchaseOrderId}>
              <button
                type="button"
                className={cn(
                  'w-full cursor-pointer text-left flex items-start justify-between gap-2 rounded-md px-2 py-1.5',
                  'bg-background/85 dark:bg-background/40 border border-amber-200/80 dark:border-amber-800/50',
                  'hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors',
                )}
                onClick={() => onNavigateToPendingPo(it)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-amber-950 dark:text-amber-50 leading-snug break-words">
                    {it.customerLabel}
                    <span className="text-amber-900/85 dark:text-amber-100/85 font-normal">
                      {' '}
                      · {it.supplierCompany} · PO #{it.poNumber}
                    </span>
                  </p>
                  <p className="text-[10px] text-amber-900/75 dark:text-amber-200/80 mt-0.5 leading-snug">
                    Open on PO Pending tab to review or clear pending.
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

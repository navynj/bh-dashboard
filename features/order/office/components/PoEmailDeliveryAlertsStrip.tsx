'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { PoEmailDeliveryAlertItem } from '../utils/collect-po-email-delivery-alerts';

type Props = {
  items: PoEmailDeliveryAlertItem[];
  /** Row body (not Send): switch tab + focus this PO in the office layout. */
  onNavigateToPo: (item: PoEmailDeliveryAlertItem) => void;
  /** Called after successful send so the parent can patch view data before refresh. */
  onSent?: (purchaseOrderId: string) => void;
};

export function PoEmailDeliveryAlertsStrip({
  items,
  onNavigateToPo,
  onSent,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errByPo, setErrByPo] = useState<Record<string, string>>({});

  if (items.length === 0) return null;

  async function send(poId: string) {
    setErrByPo((m) => {
      const next = { ...m };
      delete next[poId];
      return next;
    });
    setBusyId(poId);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/send-email`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrByPo((m) => ({
          ...m,
          [poId]:
            typeof body.error === 'string'
              ? body.error
              : `Could not send (HTTP ${res.status})`,
        }));
        return;
      }
      onSent?.(poId);
    } catch {
      setErrByPo((m) => ({
        ...m,
        [poId]: 'Network error — could not send email',
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 border-b px-3 py-2',
        'border-destructive/30 bg-destructive/[0.07]',
      )}
      role="region"
      aria-label="Purchase order email reminders"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <AlertTriangle
          className="size-3.5 shrink-0 text-destructive"
          aria-hidden
        />
        <p className="text-[11px] font-semibold text-destructive">
          PO email not recorded ({items.length})
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 max-h-[min(40vh,220px)] overflow-y-auto pr-0.5">
        {items.map((it) => {
          const busy = busyId === it.purchaseOrderId;
          const err = errByPo[it.purchaseOrderId];
          return (
            <li key={it.purchaseOrderId}>
              <div
                className={cn(
                  'flex items-start justify-between gap-2 rounded-md px-2 py-1.5 cursor-pointer',
                  'bg-background/80 border border-destructive/15',
                )}
                onClick={() => onNavigateToPo(it)}
              >
                <div className="min-w-0 flex-1 text-left rounded-sm">
                  <p className="text-[11px] font-medium text-destructive leading-snug break-words">
                    {it.customerLabel}
                    <span className="text-destructive/80 font-normal">
                      {' '}
                      · {it.supplierCompany} · PO #{it.poNumber}
                    </span>
                  </p>
                  <p className="text-[10px] text-destructive/85 mt-0.5 leading-snug">
                    {it.hasEmailContacts
                      ? 'Order channel is email — send the PO to log delivery.'
                      : 'Email channel but no addresses on file — add supplier contacts, then send.'}
                  </p>
                  {err ? (
                    <p className="text-[9px] text-destructive mt-1 leading-snug break-words">
                      {err}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 shrink-0 text-[10px] rounded-md px-2"
                  disabled={!it.hasEmailContacts || busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void send(it.purchaseOrderId);
                  }}
                >
                  {busy ? '…' : 'Send'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

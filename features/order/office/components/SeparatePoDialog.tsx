'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { formatItemPrice } from '../mappers/map-purchase-order';
import type { ShopifyOrderDraft } from '../types';
import { formatVancouverOrderedDetail } from '../utils/vancouver-datetime';
import { LineItemThumb } from './LineItemThumb';

type Props = {
  order: ShopifyOrderDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePo: (payload: {
    expectedDate: string | null;
    comment: string | null;
    shopifyOrderNumber: string;
    lineItems: {
      sku: string | null;
      productTitle: string;
      quantity: number;
      itemPrice: number | null;
      isCustom?: boolean;
      shopifyLineItemId?: string | null;
      shopifyLineItemGid?: string | null;
      shopifyVariantGid?: string | null;
      shopifyProductGid?: string | null;
    }[];
  }) => void;
  onArchive?: () => void;
};

export function SeparatePoDialog({
  order,
  open,
  onOpenChange,
  onCreatePo,
  onArchive,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [expectedDate, setExpectedDate] = useState(today);
  const [shipTo, setShipTo] = useState('');
  const [comment, setComment] = useState('');
  const [included, setIncluded] = useState<boolean[]>(
    () => order.lineItems.map((li) => li.includeInPo),
  );
  const [quantities, setQuantities] = useState<number[]>(
    () => order.lineItems.map((li) => li.quantity),
  );
  const [creating, setCreating] = useState(false);

  const anyIncluded = included.some(Boolean);

  function handleToggle(idx: number) {
    setIncluded((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }

  function handleQtyChange(idx: number, val: number) {
    setQuantities((prev) => {
      const next = [...prev];
      next[idx] = Math.max(1, val);
      return next;
    });
  }

  function handleCreate() {
    setCreating(true);
    const lineItems = order.lineItems
      .map((li, idx) => ({
        sku: li.sku,
        productTitle: li.productTitle,
        quantity: quantities[idx],
        itemPrice: li.itemPrice ? parseFloat(li.itemPrice) : null,
        isCustom: !li.shopifyVariantGid,
        shopifyLineItemId: li.shopifyLineItemId ?? null,
        shopifyLineItemGid: li.shopifyLineItemGid ?? null,
        shopifyVariantGid: li.shopifyVariantGid ?? null,
        shopifyProductGid: li.shopifyProductGid ?? null,
        included: included[idx],
      }))
      .filter((li) => li.included)
      .map(({ included: _, ...rest }) => rest);

    onCreatePo({
      expectedDate: expectedDate || null,
      comment: comment || null,
      shopifyOrderNumber: order.orderNumber,
      lineItems,
    });
  }

  const displayName =
    order.customerDisplayName ?? order.orderNumber.replace(/^#/, 'Order ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="blue" className="rounded px-1.5 text-[10px]">
              {order.orderNumber}
            </Badge>
            Separate PO — {displayName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order info */}
          <div className="flex gap-3 flex-wrap text-[11px] text-muted-foreground">
            {order.orderedAt && (
              <span>Ordered {formatVancouverOrderedDetail(order.orderedAt)}</span>
            )}
            <span>{order.customerEmail ?? '—'}</span>
            <span>{order.shippingAddressLine ?? '—'}</span>
          </div>

          {/* Line items table */}
          <div className="border rounded-lg overflow-hidden">
            <Table className="text-[11px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '34%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '5%' }} />
              </colgroup>
              <thead>
                <TableRow className="border-0 hover:bg-transparent">
                  {(
                    [
                      ['Product', 'left'],
                      ['SKU', 'left'],
                      ['Price', 'left'],
                      ['Cost', 'left'],
                      ['Qty', 'left'],
                      ['Include', 'right'],
                    ] as const
                  ).map(([h, align]) => (
                    <TableHead
                      key={h}
                      className={cn(
                        'text-[9px] font-medium text-muted-foreground px-3 py-[5px] border-b uppercase tracking-wide h-auto',
                        align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </thead>
              <TableBody>
                {order.lineItems.map((item, idx) => (
                  <TableRow
                    key={`${order.id}-${idx}-${item.sku ?? item.productTitle}`}
                    className={cn(
                      'border-b last:border-b-0 hover:bg-muted/30',
                      !included[idx] && 'opacity-40',
                    )}
                  >
                    <TableCell className="px-3 py-[7px]">
                      <div className="flex gap-2 min-w-0">
                        <LineItemThumb imageUrl={item.imageUrl} label={item.productTitle} />
                        <div className="text-[11px] leading-tight min-w-0 flex-1">
                          {item.productTitle}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-[7px] text-[9px] font-mono text-muted-foreground">
                      {item.sku ?? '—'}
                    </TableCell>
                    <TableCell className="px-3 py-[7px] text-[11px]">
                      {formatItemPrice(item.itemPrice)}
                    </TableCell>
                    <TableCell className="px-3 py-[7px] text-[11px]">
                      {formatItemPrice(item.itemCost ?? null)}
                    </TableCell>
                    <TableCell className="px-3 py-[7px]">
                      <Input
                        type="number"
                        value={quantities[idx]}
                        onChange={(e) =>
                          handleQtyChange(idx, parseInt(e.target.value, 10) || 1)
                        }
                        disabled={!included[idx]}
                        className="w-12 h-auto min-h-0 text-[11px] px-1 py-[2px] text-center md:text-[11px]"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-[7px] text-right">
                      <input
                        type="checkbox"
                        checked={included[idx]}
                        onChange={() => handleToggle(idx)}
                        className="align-middle"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* PO fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Expected date</Label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ship to</Label>
              <Input
                type="text"
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                placeholder="Address"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional"
              className="min-h-14 resize-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              disabled={!anyIncluded || creating}
              className="text-xs"
              onClick={handleCreate}
            >
              {creating ? 'Creating…' : 'Create PO'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {onArchive && (
              <>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    onArchive();
                    onOpenChange(false);
                  }}
                >
                  Archive
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

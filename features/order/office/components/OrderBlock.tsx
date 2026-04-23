'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import type { PrePoLineDraft, ShopifyOrderDraft } from '../types';
import { formatItemPrice } from '../mappers/map-purchase-order';
import { formatVancouverOrderedDetail } from '../utils/vancouver-datetime';
import { SeparatePoDialog } from './SeparatePoDialog';
import { LineItemThumb } from './LineItemThumb';
import type { ShopifyOrderEditOperation } from '@/lib/api/schemas';

type SeparatePoPayload = {
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
};

type DraftLine = PrePoLineDraft & {
  localId: string;
  removed?: boolean;
  isNew?: boolean;
  newKind?: 'variant' | 'custom';
};

type Props = {
  order: ShopifyOrderDraft;
  inclusions?: boolean[];
  onToggleInclude?: (orderId: string, itemIdx: number) => void;
  onSeparatePo?: (payload: SeparatePoPayload) => void;
  onArchiveShopifyOrder?: (shopifyOrderDbId: string) => void;
  showArchived?: boolean;
  onUnarchiveShopifyOrder?: (shopifyOrderDbId: string) => void;
  /** When saving from a PO context, pass PO id so server can resync lines. */
  purchaseOrderId?: string | null;
};

function parseMoney(s: string | null | undefined): number {
  if (s == null || s === '') return 0;
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function newLocalId(): string {
  return `l_${Math.random().toString(36).slice(2, 11)}`;
}

function draftFromOrder(order: ShopifyOrderDraft): DraftLine[] {
  return order.lineItems.map((li) => ({
    ...li,
    localId: li.shopifyLineItemGid ?? li.shopifyLineItemId ?? newLocalId(),
  }));
}

type SearchHit = {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string | null;
  sku: string | null;
  price: string | null;
  imageUrl?: string | null;
};

export function OrderBlock({
  order,
  inclusions,
  onToggleInclude,
  onSeparatePo,
  onArchiveShopifyOrder,
  showArchived,
  onUnarchiveShopifyOrder,
  purchaseOrderId,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => draftFromOrder(order));
  const [saving, setSaving] = useState(false);
  const originalByGid = useRef<Map<string, { quantity: number; itemPrice: string | null }>>(
    new Map(),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addTab, setAddTab] = useState<'search' | 'custom'>('search');
  const [customTitle, setCustomTitle] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const [priceDialog, setPriceDialog] = useState<{
    gid: string;
    variantGid: string | null;
    productGid: string | null;
    newUnit: number;
    resolve: (c: 'yes' | 'no' | 'skip') => void;
  } | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraftLines(draftFromOrder(order));
    }
  }, [order, editing]);

  const getIncluded = (idx: number) =>
    inclusions ? inclusions[idx] : order.lineItems[idx]?.includeInPo ?? true;
  const excluded = order.lineItems.filter((_, idx) => !getIncluded(idx));
  const displayName =
    order.customerDisplayName ?? order.orderNumber.replace(/^#/, 'Order ');

  const beginEdit = useCallback(() => {
    const m = new Map<string, { quantity: number; itemPrice: string | null }>();
    for (const li of order.lineItems) {
      if (li.shopifyLineItemGid) {
        m.set(li.shopifyLineItemGid, { quantity: li.quantity, itemPrice: li.itemPrice });
      }
    }
    originalByGid.current = m;
    setDraftLines(draftFromOrder(order));
    setEditing(true);
  }, [order]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraftLines(draftFromOrder(order));
  }, [order]);

  const askCatalog = useCallback(
    (gid: string, variantGid: string | null, productGid: string | null, newUnit: number) => {
      return new Promise<'yes' | 'no' | 'skip'>((resolve) => {
        if (!variantGid || !productGid) {
          resolve('skip');
          return;
        }
        setPriceDialog({
          gid,
          variantGid,
          productGid,
          newUnit,
          resolve: (c) => {
            setPriceDialog(null);
            resolve(c);
          },
        });
      });
    },
    [],
  );

  const buildSavePayload = useCallback(async () => {
    const ops: ShopifyOrderEditOperation[] = [];
    const variantCatalogUpdates: { productGid: string; variantGid: string; price: string }[] = [];
    const orig = originalByGid.current;

    for (const [gid, o] of orig) {
      const row = draftLines.find((d) => d.shopifyLineItemGid === gid && !d.removed);
      if (!row) {
        ops.push({ type: 'setQuantity', shopifyLineItemGid: gid, quantity: 0, restock: false });
        continue;
      }
      if (row.quantity !== o.quantity) {
        ops.push({
          type: 'setQuantity',
          shopifyLineItemGid: gid,
          quantity: row.quantity,
          restock: false,
        });
      }
      const oldP = parseMoney(o.itemPrice);
      const newP = parseMoney(row.itemPrice);
      if (Math.abs(oldP - newP) > 0.0005 && row.shopifyLineItemGid) {
        const choice = await askCatalog(
          gid,
          row.shopifyVariantGid ?? null,
          row.shopifyProductGid ?? null,
          newP,
        );
        ops.push({ type: 'setUnitPrice', shopifyLineItemGid: gid, unitPrice: newP });
        if (choice === 'yes' && row.shopifyVariantGid && row.shopifyProductGid) {
          variantCatalogUpdates.push({
            productGid: row.shopifyProductGid,
            variantGid: row.shopifyVariantGid,
            price: newP.toFixed(2),
          });
        }
      }
    }

    for (const row of draftLines) {
      if (row.removed || row.shopifyLineItemGid) continue;
      if (row.isNew && row.newKind === 'variant' && row.shopifyVariantGid) {
        const unit = parseMoney(row.itemPrice);
        if (row.shopifyProductGid) {
          const choice = await askCatalog(
            row.localId,
            row.shopifyVariantGid,
            row.shopifyProductGid,
            unit,
          );
          if (choice === 'yes') {
            variantCatalogUpdates.push({
              productGid: row.shopifyProductGid,
              variantGid: row.shopifyVariantGid,
              price: unit.toFixed(2),
            });
          }
        }
        ops.push({
          type: 'addVariant',
          variantGid: row.shopifyVariantGid,
          quantity: Math.max(1, row.quantity),
          allowDuplicates: true,
          unitPriceOverride: unit > 0 ? unit : undefined,
        });
      } else if (row.isNew && row.newKind === 'custom') {
        ops.push({
          type: 'addCustomItem',
          title: row.productTitle,
          unitPrice: parseMoney(row.itemPrice),
          quantity: Math.max(1, row.quantity),
        });
      }
    }

    return { ops, variantCatalogUpdates };
  }, [draftLines, askCatalog]);

  const saveEdit = useCallback(async () => {
    if (!order.shopifyOrderGid) {
      toast.error('This order is missing a Shopify reference.');
      return;
    }
    setSaving(true);
    try {
      const { ops, variantCatalogUpdates } = await buildSavePayload();
      if (ops.length === 0) {
        toast.message('No changes to save');
        setEditing(false);
        return;
      }

      const hasAppend = ops.some((o) => o.type === 'addVariant' || o.type === 'addCustomItem');

      const res = await fetch(`/api/order-office/shopify-orders/${order.id}/apply-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: ops,
          variantCatalogUpdates:
            variantCatalogUpdates.length > 0 ? variantCatalogUpdates : undefined,
          purchaseOrderId: purchaseOrderId ?? undefined,
          appendLinesFromShopifyOrderLocalId: hasAppend ? order.id : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof body?.error === 'string' ? body.error : 'Save failed');
        return;
      }
      toast.success('Order updated');
      setEditing(false);
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }, [order, purchaseOrderId, buildSavePayload, router]);

  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/order-office/shopify-products/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : 'Search failed');
        setSearchHits([]);
        return;
      }
      setSearchHits(Array.isArray(data.hits) ? data.hits : []);
    } catch {
      toast.error('Search failed');
      setSearchHits([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQ]);

  const addSearchHit = useCallback((hit: SearchHit) => {
    const price = hit.price ?? '0';
    setDraftLines((prev) => [
      ...prev,
      {
        localId: newLocalId(),
        isNew: true,
        newKind: 'variant',
        shopifyLineItemId: undefined,
        shopifyLineItemGid: undefined,
        shopifyVariantGid: hit.variantId,
        shopifyProductGid: hit.productId,
        sku: hit.sku,
        imageUrl: hit.imageUrl ?? null,
        productTitle: `${hit.productTitle}${hit.variantTitle ? ` — ${hit.variantTitle}` : ''}`,
        itemPrice: price,
        quantity: 1,
        includeInPo: true,
      },
    ]);
    setAddOpen(false);
    setSearchQ('');
    setSearchHits([]);
  }, []);

  const addCustomLine = useCallback(() => {
    const title = customTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }
    const qty = Math.max(1, parseInt(customQty, 10) || 1);
    const unit = parseMoney(customPrice);
    setDraftLines((prev) => [
      ...prev,
      {
        localId: newLocalId(),
        isNew: true,
        newKind: 'custom',
        sku: null,
        productTitle: title,
        itemPrice: unit.toFixed(2),
        quantity: qty,
        includeInPo: true,
      },
    ]);
    setCustomTitle('');
    setCustomPrice('');
    setCustomQty('1');
    setAddOpen(false);
  }, [customTitle, customPrice, customQty]);

  const visibleDrafts = useMemo(() => draftLines.filter((d) => !d.removed), [draftLines]);

  return (
    <div className="bg-background border border-border rounded-[10px] overflow-hidden mb-2">
      <div className="px-3.5 py-2 border-b bg-muted/40 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[12px] font-medium">
            <Badge variant="blue" className="rounded px-1.5 text-[10px]">
              {order.orderNumber}
            </Badge>
            {displayName}
          </div>
          <div className="flex gap-2.5 flex-wrap">
            {order.orderedAt && (
              <span className="text-[10px] text-muted-foreground">
                Ordered {formatVancouverOrderedDetail(order.orderedAt)}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {order.customerEmail ?? '—'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {order.shippingAddressLine ?? '—'}
            </span>
            {order.note && (
              <span
                className={cn(
                  'text-[10px]',
                  order.noteIsWarning
                    ? 'text-[#A32D2D]'
                    : 'text-muted-foreground',
                )}
              >
                Note:{' '}
                <span
                  className={cn(
                    order.noteIsWarning ? 'text-[#A32D2D]' : 'text-foreground',
                  )}
                >
                  {order.note}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-1 mt-0.5">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="xs"
                className="text-[10px] rounded-[5px]"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                className="text-[10px] rounded-[5px]"
                onClick={() => void saveEdit()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : showArchived ? (
            onUnarchiveShopifyOrder ? (
              <Button
                variant="outline"
                size="xs"
                className="text-[10px] rounded-[5px]"
                onClick={() => void onUnarchiveShopifyOrder(order.id)}
              >
                Unarchive
              </Button>
            ) : null
          ) : (
            <>
              <Button
                variant="outline"
                size="xs"
                className="text-[10px] rounded-[5px]"
                onClick={beginEdit}
              >
                Edit order
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="text-[10px] rounded-[5px]"
                onClick={() => setDialogOpen(true)}
              >
                Separate PO
              </Button>
            </>
          )}
        </div>
      </div>

      {onSeparatePo && (
        <SeparatePoDialog
          order={order}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreatePo={(payload) => {
            onSeparatePo(payload);
            setDialogOpen(false);
          }}
          onArchive={
            onArchiveShopifyOrder
              ? () => onArchiveShopifyOrder(order.id)
              : undefined
          }
        />
      )}

      {editing && (
        <div className="px-3.5 py-1.5 border-b flex items-center gap-2 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="text-[10px] rounded-[5px]"
            onClick={() => {
              setAddTab('search');
              setAddOpen(true);
            }}
          >
            Add line
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Fulfilled lines may be blocked by Shopify from editing.
          </span>
        </div>
      )}

      <Table
        className="border-collapse text-[11px]"
        style={{ tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: editing ? '32%' : '36%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: editing ? '12%' : '8%' }} />
          {!editing && <col style={{ width: '5%' }} />}
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
                ...(editing ? [['', 'right'] as const] : [['Include', 'right'] as const]),
              ] as const
            ).map(([h, align]) => (
              <TableHead
                key={h || 'actions'}
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
          {(editing ? visibleDrafts : order.lineItems).map((item, idx) => {
            const row = editing
              ? (item as DraftLine)
              : (order.lineItems[idx] as PrePoLineDraft);
            const included = editing ? true : getIncluded(idx);
            return (
              <TableRow
                key={editing ? (row as DraftLine).localId : `${order.id}-${idx}-${row.sku ?? row.productTitle}`}
                className={cn(
                  'border-b last:border-b-0 hover:bg-muted/30',
                  !editing && !included && 'opacity-40',
                  editing && (row as DraftLine).removed && 'hidden',
                )}
              >
                <TableCell className="px-3 py-[7px]">
                  <div className="flex gap-2 min-w-0">
                    <LineItemThumb imageUrl={row.imageUrl} label={row.productTitle} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] leading-tight">{row.productTitle}</div>
                      <div className="text-[9px] text-muted-foreground font-mono">
                        {row.sku ?? '—'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-[7px] text-[9px] font-mono text-muted-foreground">
                  {row.sku ?? '—'}
                </TableCell>
                <TableCell className="px-3 py-[7px] text-[11px]">
                  {editing ? (
                    <Input
                      className="h-7 text-[11px]"
                      value={row.itemPrice ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftLines((prev) =>
                          prev.map((d) =>
                            d.localId === (row as DraftLine).localId ? { ...d, itemPrice: v || null } : d,
                          ),
                        );
                      }}
                    />
                  ) : (
                    formatItemPrice(row.itemPrice)
                  )}
                </TableCell>
                <TableCell className="px-3 py-[7px] text-[11px]">
                  {formatItemPrice((row as PrePoLineDraft).itemCost ?? null)}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-3 py-[7px] text-[11px] tabular-nums',
                    row.disabled && 'text-muted-foreground',
                  )}
                >
                  {editing ? (
                    <Input
                      className="h-7 text-[11px]"
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setDraftLines((prev) =>
                          prev.map((d) =>
                            d.localId === (row as DraftLine).localId
                              ? { ...d, quantity: Number.isFinite(n) ? Math.max(0, n) : 0 }
                              : d,
                          ),
                        );
                      }}
                    />
                  ) : (
                    row.quantity
                  )}
                </TableCell>
                {editing ? (
                  <TableCell className="px-3 py-[7px] text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-[10px] h-7 text-destructive"
                      onClick={() => {
                        const dl = row as DraftLine;
                        if (dl.shopifyLineItemGid) {
                          setDraftLines((prev) =>
                            prev.map((d) =>
                              d.localId === dl.localId ? { ...d, removed: true } : d,
                            ),
                          );
                        } else {
                          setDraftLines((prev) => prev.filter((d) => d.localId !== dl.localId));
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                ) : (
                  <TableCell className="px-3 py-[7px] text-right">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => onToggleInclude?.(order.id, idx)}
                      className="align-middle"
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {!editing && excluded.length > 0 && (
        <div className="px-3.5 py-[6px] border-t text-[10px] text-muted-foreground">
          {excluded.map((i) => i.sku ?? i.productTitle).join(', ')} excluded — will not appear
          in PO
        </div>
      )}

      <Dialog
        open={priceDialog != null}
        onOpenChange={(open) => {
          if (!open) priceDialog?.resolve('no');
        }}
      >
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-sm">Update catalog variant price?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            You changed a line price. Should we also update the variant&apos;s catalog price in
            Shopify (affects future checkouts), or only this order?
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => priceDialog?.resolve('no')}>
              Order only
            </Button>
            <Button type="button" onClick={() => priceDialog?.resolve('yes')}>
              Order + catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Add line</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              size="xs"
              variant={addTab === 'search' ? 'default' : 'outline'}
              onClick={() => setAddTab('search')}
            >
              Search catalog
            </Button>
            <Button
              type="button"
              size="xs"
              variant={addTab === 'custom' ? 'default' : 'outline'}
              onClick={() => setAddTab('custom')}
            >
              Custom line
            </Button>
          </div>
          {addTab === 'search' ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search products…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch();
                  }}
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => void runSearch()}>
                  {searchLoading ? '…' : 'Search'}
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
                {searchHits.length === 0 ? (
                  <div className="p-3 text-[12px] text-muted-foreground">No results</div>
                ) : (
                  searchHits.map((h) => (
                    <button
                      key={h.variantId}
                      type="button"
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-muted/50 flex gap-2 items-start"
                      onClick={() => addSearchHit(h)}
                    >
                      <LineItemThumb imageUrl={h.imageUrl} label={h.productTitle} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{h.productTitle}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {(h.variantTitle ?? 'Default') +
                            (h.sku ? ` · ${h.sku}` : '') +
                            (h.price ? ` · $${h.price}` : '')}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Unit price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
                <Input
                  placeholder="Qty"
                  type="number"
                  min={1}
                  className="w-20"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" onClick={addCustomLine}>
                  Add
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

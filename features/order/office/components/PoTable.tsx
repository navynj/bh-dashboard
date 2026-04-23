'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { formatShopifyOrderDisplayFulfillmentStatus } from '@/types/shopify';
import {
  formatProductLabel,
  type LineFulfillmentStatus,
  type OfficePurchaseOrderBlock,
  type PoLineItemView,
} from '../types';
import { formatItemPrice } from '../mappers/map-purchase-order';
import type { ShopifyOrderEditOperation } from '@/lib/api/schemas';
import type { OfficeProductSearchVariantHit } from '@/lib/shopify/searchProducts';
import { LineItemThumb } from './LineItemThumb';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = { purchaseOrder: OfficePurchaseOrderBlock };

const badgeCompact = 'rounded px-1.5 text-[10px]';

const RECV_TONE_RED: LineFulfillmentStatus[] = [
  'UNFULFILLED',
  'OPEN',
  'RESTOCKED',
  'REQUEST_DECLINED',
];

function recvCellTone(status: LineFulfillmentStatus): string {
  if (status === 'FULFILLED') return 'text-[#27500A]';
  if (RECV_TONE_RED.includes(status)) return 'text-[#A32D2D]';
  return 'text-[#BA7517]';
}

function StatusBadge({ status }: { status: LineFulfillmentStatus }) {
  const label = formatShopifyOrderDisplayFulfillmentStatus(status);
  if (status === 'FULFILLED') {
    return (
      <Badge variant="green" className={badgeCompact}>
        {label}
      </Badge>
    );
  }
  if (RECV_TONE_RED.includes(status)) {
    return (
      <Badge variant="red" className={badgeCompact}>
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="amber" className={badgeCompact}>
      {label}
    </Badge>
  );
}

// ─── Icon: checklist (signals "enter selection mode") ─────────────────────────

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

type EditPoLine = PoLineItemView & {
  _local: string;
  _removed?: boolean;
  _isNew?: boolean;
  _newKind?: 'variant' | 'custom';
};

function parseMoney(s: string | null | undefined): number {
  if (s == null || s === '') return 0;
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function poLocalKey(): string {
  return `p_${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Main component ────────────────────────────────────────────────────────────

function nextFulfillmentStatus(
  qty: number,
  quantityReceived: number,
): LineFulfillmentStatus {
  if (qty <= 0) return 'FULFILLED';
  if (quantityReceived >= qty) return 'FULFILLED';
  if (quantityReceived > 0) return 'PARTIALLY_FULFILLED';
  return 'UNFULFILLED';
}

export function PoTable({ purchaseOrder }: Props) {
  const router = useRouter();
  const [optimisticLineItems, setOptimisticLineItems] = useState<
    PoLineItemView[] | null
  >(null);

  useEffect(() => {
    setOptimisticLineItems(null);
  }, [purchaseOrder.id]);

  const items = optimisticLineItems ?? purchaseOrder.lineItems;

  const fulfilled = items.filter(
    (i) => i.fulfillmentStatus === 'FULFILLED',
  ).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
  const allFulfilled = fulfilled === total && total > 0;
  const noneFulfilled = fulfilled === 0;

  // ── Fulfill mode state ────────────────────────────────────────────────────
  const [fulfillMode, setFulfillMode] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [recvValues, setRecvValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [orderEditMode, setOrderEditMode] = useState(false);
  const [editLines, setEditLines] = useState<EditPoLine[]>([]);
  const [origByGid, setOrigByGid] = useState<Map<string, { qty: number; price: string | null }>>(
    () => new Map(),
  );
  const linkedOrders = useMemo(
    () => purchaseOrder.panelMeta?.linkedShopifyOrders ?? [],
    [purchaseOrder.panelMeta],
  );
  const defaultTargetOrderId = linkedOrders[0]?.id ?? '';
  const [newLineTargetOrderId, setNewLineTargetOrderId] = useState(() => defaultTargetOrderId);
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);
  const [orderEditError, setOrderEditError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<'search' | 'custom'>('search');
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<OfficeProductSearchVariantHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const enterFulfillMode = useCallback(() => {
    const initChecked: Record<string, boolean> = {};
    const initRecv: Record<string, number> = {};
    for (const item of items) {
      initChecked[item.id] = item.fulfillmentStatus !== 'FULFILLED';
      initRecv[item.id] = item.quantity;
    }
    setChecked(initChecked);
    setRecvValues(initRecv);
    setSaveError(null);
    setOrderEditMode(false);
    setFulfillMode(true);
  }, [items]);

  const exitFulfillMode = useCallback(() => {
    setFulfillMode(false);
    setChecked({});
    setRecvValues({});
    setSaveError(null);
  }, []);

  const toggleItem = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleAll = useCallback(() => {
    const allChecked = items.every((i) => checked[i.id]);
    const next: Record<string, boolean> = {};
    for (const item of items) next[item.id] = !allChecked;
    setChecked(next);
  }, [items, checked]);

  const setRecv = useCallback((id: string, value: number) => {
    setRecvValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const markAllReceived = useCallback(() => {
    const next: Record<string, number> = { ...recvValues };
    for (const item of items) {
      if (checked[item.id]) next[item.id] = item.quantity;
    }
    setRecvValues(next);
  }, [items, checked, recvValues]);

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allItemsChecked = items.length > 0 && items.every((i) => checked[i.id]);
  const someChecked = checkedCount > 0 && !allItemsChecked;

  const handleFulfill = useCallback(async () => {
    const sourceItems = optimisticLineItems ?? purchaseOrder.lineItems;
    const toSave = sourceItems
      .filter((i) => checked[i.id])
      .map((i) => ({
        id: i.id,
        quantityReceived: Math.max(0, recvValues[i.id] ?? i.quantityReceived),
      }));

    if (toSave.length === 0) return;

    const optimisticNext = sourceItems.map((i) => {
      if (!checked[i.id]) return i;
      const quantityReceived = Math.max(0, recvValues[i.id] ?? i.quantityReceived);
      return {
        ...i,
        quantityReceived,
        fulfillmentStatus: nextFulfillmentStatus(i.quantity, quantityReceived),
      };
    });
    setOptimisticLineItems(optimisticNext);

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(
        `/api/purchase-orders/${purchaseOrder.id}/receive`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: toSave }),
        },
      );

      const body = (await res.json().catch(() => null)) as {
        error?: string;
        shopifyWarnings?: string[];
      } | null;

      if (!res.ok) {
        setOptimisticLineItems(null);
        setSaveError(body?.error ?? 'Failed to save fulfillment');
        toast.error(body?.error ?? 'Failed to save fulfillment');
        return;
      }

      const warnings = body?.shopifyWarnings;
      if (Array.isArray(warnings) && warnings.length > 0) {
        toast.warning('Saved in hub; Shopify fulfillment issue', {
          description: warnings.slice(0, 3).join(' · '),
        });
      } else {
        toast.success('Fulfillment saved');
      }

      setOptimisticLineItems(null);
      exitFulfillMode();
      router.refresh();
    } catch {
      setOptimisticLineItems(null);
      setSaveError('Network error — please try again');
      toast.error('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }, [
    purchaseOrder.lineItems,
    optimisticLineItems,
    checked,
    recvValues,
    purchaseOrder.id,
    exitFulfillMode,
    router,
  ]);

  const enterOrderEditMode = useCallback(() => {
    setFulfillMode(false);
    const m = new Map<string, { qty: number; price: string | null }>();
    for (const li of items) {
      if (li.shopifyLineItemGid) {
        m.set(li.shopifyLineItemGid, { qty: li.quantity, price: li.itemPrice });
      }
    }
    setOrigByGid(m);
    setEditLines(
      items.map((li) => ({
        ...li,
        _local: li.id,
      })),
    );
    setNewLineTargetOrderId(defaultTargetOrderId || linkedOrders[0]?.id || '');
    setOrderEditError(null);
    setOrderEditMode(true);
  }, [items, defaultTargetOrderId, linkedOrders]);

  const exitOrderEditMode = useCallback(() => {
    setOrderEditMode(false);
    setEditLines([]);
    setOrderEditError(null);
  }, []);

  const visibleEditLines = useMemo(
    () => editLines.filter((l) => !l._removed),
    [editLines],
  );

  const runProductSearch = useCallback(async () => {
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

  const saveOrderEdits = useCallback(async () => {
    setSavingOrderEdit(true);
    setOrderEditError(null);
    try {
      const variantCatalogUpdates: { productGid: string; variantGid: string; price: string }[] =
        [];
      const groups = new Map<string, ShopifyOrderEditOperation[]>();
      const ensure = (id: string) => {
        if (!groups.has(id)) groups.set(id, []);
        return groups.get(id)!;
      };

      for (const [gid, o] of origByGid) {
        const row = editLines.find((d) => d.shopifyLineItemGid === gid && !d._removed);
        const orderLocalId = items.find((i) => i.shopifyLineItemGid === gid)?.shopifyOrderId;
        if (!orderLocalId) continue;
        if (!row) {
          ensure(orderLocalId).push({
            type: 'setQuantity',
            shopifyLineItemGid: gid,
            quantity: 0,
            restock: false,
          });
          continue;
        }
        if (row.quantity !== o.qty) {
          ensure(orderLocalId).push({
            type: 'setQuantity',
            shopifyLineItemGid: gid,
            quantity: row.quantity,
            restock: false,
          });
        }
        const oldP = parseMoney(o.price);
        const newP = parseMoney(row.itemPrice);
        if (Math.abs(oldP - newP) > 0.0005) {
          if (row.shopifyVariantGid && row.shopifyProductGid) {
            const upd = window.confirm(
              'Also update the catalog variant price in Shopify for this line?',
            );
            if (upd) {
              variantCatalogUpdates.push({
                productGid: row.shopifyProductGid,
                variantGid: row.shopifyVariantGid,
                price: newP.toFixed(2),
              });
            }
          }
          ensure(orderLocalId).push({
            type: 'setUnitPrice',
            shopifyLineItemGid: gid,
            unitPrice: newP,
          });
        }
      }

      for (const row of editLines) {
        if (row._removed || row.shopifyLineItemGid) continue;
        const target = newLineTargetOrderId;
        if (!target) {
          setOrderEditError('Select a Shopify order for new lines.');
          return;
        }
        if (row._isNew && row._newKind === 'variant' && row.shopifyVariantGid) {
          const unit = parseMoney(row.itemPrice);
          if (row.shopifyProductGid && row.shopifyVariantGid) {
            const upd = window.confirm(
              'Also update the catalog variant price for this new line?',
            );
            if (upd) {
              variantCatalogUpdates.push({
                productGid: row.shopifyProductGid,
                variantGid: row.shopifyVariantGid,
                price: unit.toFixed(2),
              });
            }
          }
          ensure(target).push({
            type: 'addVariant',
            variantGid: row.shopifyVariantGid,
            quantity: Math.max(1, row.quantity),
            allowDuplicates: true,
            unitPriceOverride: unit > 0 ? unit : undefined,
          });
        } else if (row._isNew && row._newKind === 'custom') {
          ensure(target).push({
            type: 'addCustomItem',
            title: row.productTitle ?? 'Custom',
            unitPrice: parseMoney(row.itemPrice),
            quantity: Math.max(1, row.quantity),
          });
        }
      }

      const entries = [...groups.entries()].filter(([, ops]) => ops.length > 0);
      if (entries.length === 0) {
        toast.message('No Shopify changes to save');
        setOrderEditMode(false);
        return;
      }

      let hadAdds = false;
      for (const [, ops] of entries) {
        if (ops.some((o) => o.type === 'addVariant' || o.type === 'addCustomItem')) {
          hadAdds = true;
          break;
        }
      }

      let i = 0;
      for (const [localOrderId, ops] of entries) {
        i += 1;
        const isLast = i === entries.length;
        const addsHere = ops.some((o) => o.type === 'addVariant' || o.type === 'addCustomItem');
        const res = await fetch(`/api/order-office/shopify-orders/${localOrderId}/apply-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operations: ops,
            variantCatalogUpdates: isLast && variantCatalogUpdates.length ? variantCatalogUpdates : undefined,
            purchaseOrderId: purchaseOrder.id,
            appendLinesFromShopifyOrderLocalId:
              hadAdds && addsHere && newLineTargetOrderId === localOrderId
                ? localOrderId
                : undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setOrderEditError(typeof body?.error === 'string' ? body.error : 'Save failed');
          return;
        }
      }

      toast.success('Shopify order(s) updated');
      setOrderEditMode(false);
      router.refresh();
    } catch {
      setOrderEditError('Network error');
    } finally {
      setSavingOrderEdit(false);
    }
  }, [
    origByGid,
    editLines,
    items,
    purchaseOrder.id,
    newLineTargetOrderId,
    router,
  ]);

  // ── Columns layout ─────────────────────────────────────────────────────────
  // Normal:   checkbox(0) | shopify# | product | ref | price | qty | recv | status
  // Fulfill:  checkbox(5%) | shopify# | product | ref | price | qty | recv | status

  const tableRows = orderEditMode ? visibleEditLines : items;

  const addSearchHitToPo = useCallback(
    (hit: OfficeProductSearchVariantHit) => {
      const key = poLocalKey();
      const ord = linkedOrders.find((o) => o.id === newLineTargetOrderId);
      setEditLines((prev) => [
        ...prev,
        {
          id: key,
          purchaseOrderId: purchaseOrder.id,
          sequence: prev.length + 1,
          quantity: 1,
          quantityReceived: 0,
          supplierRef: null,
          sku: hit.sku,
          variantTitle: hit.variantTitle,
          productTitle: `${hit.productTitle}${hit.variantTitle ? ` — ${hit.variantTitle}` : ''}`,
          imageUrl: hit.imageUrl ?? null,
          isCustom: false,
          itemPrice: hit.price ?? '0',
          shopifyOrderLineItemId: null,
          shopifyLineItemGid: null,
          shopifyVariantGid: hit.variantId,
          shopifyProductGid: hit.productId,
          shopifyOrderId: newLineTargetOrderId || null,
          shopifyOrderNumber: ord?.name ?? '—',
          fulfillmentStatus: 'UNFULFILLED' as LineFulfillmentStatus,
          _local: key,
          _isNew: true,
          _newKind: 'variant' as const,
        },
      ]);
      setAddOpen(false);
      setSearchQ('');
      setSearchHits([]);
    },
    [linkedOrders, newLineTargetOrderId, purchaseOrder.id],
  );

  const addCustomLineToPo = useCallback(() => {
    const title = customTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }
    const qty = Math.max(1, parseInt(customQty, 10) || 1);
    const key = poLocalKey();
    const ord = linkedOrders.find((o) => o.id === newLineTargetOrderId);
    setEditLines((prev) => [
      ...prev,
      {
        id: key,
        purchaseOrderId: purchaseOrder.id,
        sequence: prev.length + 1,
        quantity: qty,
        quantityReceived: 0,
        supplierRef: null,
        sku: null,
        variantTitle: null,
        productTitle: title,
        isCustom: true,
        itemPrice: parseMoney(customPrice).toFixed(2),
        shopifyOrderLineItemId: null,
        shopifyLineItemGid: null,
        shopifyVariantGid: null,
        shopifyProductGid: null,
        shopifyOrderId: newLineTargetOrderId || null,
        shopifyOrderNumber: ord?.name ?? '—',
        fulfillmentStatus: 'UNFULFILLED' as LineFulfillmentStatus,
        _local: key,
        _isNew: true,
        _newKind: 'custom' as const,
      },
    ]);
    setCustomTitle('');
    setCustomPrice('');
    setCustomQty('1');
    setAddOpen(false);
  }, [customTitle, customPrice, customQty, linkedOrders, newLineTargetOrderId, purchaseOrder.id]);

  // Show skeleton while line items are being lazy-loaded
  const lazyLineCount = purchaseOrder.panelMeta?.fulfillTotalCount ?? 0;
  if (items.length === 0 && lazyLineCount > 0) {
    return (
      <div className="bg-background border border-border rounded-[10px] overflow-hidden mb-2.5">
        <div className="flex items-center justify-between px-3.5 py-2 border-b bg-muted/40">
          <div className="text-[12px] font-medium">{purchaseOrder.title}</div>
        </div>
        {Array.from({ length: Math.min(lazyLineCount, 10) }).map((_, i) => (
          <div key={i} className="h-9 border-b last:border-0 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-[10px] overflow-hidden mb-2.5">
      {/* ── Table header ── */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b bg-muted/40">
        <div className="text-[12px] font-medium flex items-center gap-2">
          {purchaseOrder.title}
          {purchaseOrder.shopifyOrderCount > 0 && (
            <span className="text-[10px] font-normal text-muted-foreground">
              · {purchaseOrder.shopifyOrderCount} Shopify order
              {purchaseOrder.shopifyOrderCount !== 1 ? 's' : ''} combined
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {orderEditMode ? (
            <>
              <Button
                variant="outline"
                size="xs"
                className="text-[10px] rounded-[5px]"
                onClick={exitOrderEditMode}
                disabled={savingOrderEdit}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                className="text-[10px] rounded-[5px]"
                onClick={() => void saveOrderEdits()}
                disabled={savingOrderEdit}
              >
                {savingOrderEdit ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="xs"
              className="text-[10px] rounded-[5px]"
              disabled={fulfillMode}
              onClick={enterOrderEditMode}
            >
              Edit order lines
            </Button>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {saveError && (
        <div className="px-3.5 py-1.5 text-[11px] text-destructive bg-destructive/5 border-b">
          {saveError}
        </div>
      )}
      {orderEditError && (
        <div className="px-3.5 py-1.5 text-[11px] text-destructive bg-destructive/5 border-b">
          {orderEditError}
        </div>
      )}

      {orderEditMode && (
        <div className="px-3.5 py-2 border-b flex flex-wrap items-center gap-3 bg-muted/20 text-[11px]">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground whitespace-nowrap">New lines attach to</span>
            <select
              className="border rounded px-2 py-1 text-[11px] bg-background"
              value={newLineTargetOrderId}
              onChange={(e) => setNewLineTargetOrderId(e.target.value)}
            >
              {linkedOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
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
        </div>
      )}

      {/* ── Progress bar + Fulfill controls ── */}
      <div className="flex items-center gap-2 px-3.5 py-[5px] text-[11px] text-muted-foreground border-b">
        <span>Fulfilled</span>
        <div className="flex-1 h-[3px] rounded bg-muted overflow-hidden">
          <div
            className="h-full rounded bg-[#639922] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            'font-medium',
            allFulfilled
              ? 'text-[#27500A]'
              : noneFulfilled
                ? 'text-[#A32D2D]'
                : 'text-foreground',
          )}
        >
          {fulfilled} / {total} items
        </span>

        {/* Fulfill button / mode controls */}
        {fulfillMode ? (
          <div className="flex items-center gap-1 ml-1">
            {checkedCount > 0 && (
              <button
                type="button"
                onClick={markAllReceived}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Mark all received
              </button>
            )}
            <Button
              variant="outline"
              size="xs"
              className="text-[10px] rounded-[5px]"
              onClick={exitFulfillMode}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              className="text-[10px] rounded-[5px] gap-1"
              onClick={handleFulfill}
              disabled={saving || checkedCount === 0}
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  Fulfill
                  {checkedCount > 0 && (
                    <span className="opacity-75">({checkedCount})</span>
                  )}
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            size="xs"
            className="text-[10px] rounded-[5px] gap-1 ml-1"
            onClick={enterFulfillMode}
            disabled={orderEditMode}
          >
            <ChecklistIcon />
            Fulfill Items
          </Button>
        )}
      </div>

      {/* ── Items table ── */}
      <Table
        className="border-collapse text-[11px]"
        style={{ tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: fulfillMode ? '30%' : orderEditMode ? '26%' : '32%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: fulfillMode ? '10%' : '9%' }} />
          <col style={{ width: fulfillMode ? '18%' : orderEditMode ? '16%' : '22%' }} />
          {orderEditMode && <col style={{ width: '10%' }} />}
          {fulfillMode && <col style={{ width: '6%' }} />}
        </colgroup>

        <thead>
          <TableRow className="border-0 hover:bg-transparent">
            {[
              'Shopify #',
              'Product',
              'Ref.',
              'Price',
              'Qty',
              'Received',
              'Status',
            ].map((h) => (
              <TableHead
                key={h}
                className="text-[9px] font-medium text-muted-foreground px-3 py-[5px] border-b text-left uppercase tracking-wide h-auto"
              >
                {h}
              </TableHead>
            ))}
            {orderEditMode && (
              <TableHead className="text-[9px] font-medium text-muted-foreground px-3 py-[5px] border-b text-right uppercase tracking-wide h-auto">
                Edit
              </TableHead>
            )}
            {fulfillMode && (
              <TableHead className="px-3 py-[5px] border-b h-auto text-center">
                <input
                  type="checkbox"
                  checked={allItemsChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  className="h-3 w-3 cursor-pointer accent-foreground"
                />
              </TableHead>
            )}
          </TableRow>
        </thead>

        <TableBody>
          {tableRows.map((item) => {
            const row = item as EditPoLine;
            const isChecked = !!checked[item.id];
            const rowDisabled = fulfillMode && !isChecked;
            const editable =
              orderEditMode && (Boolean(row.shopifyLineItemGid) || Boolean(row._isNew));

            return (
              <TableRow
                key={orderEditMode ? row._local : item.id}
                className={cn(
                  'border-b last:border-b-0',
                  fulfillMode
                    ? isChecked
                      ? 'bg-blue-50/40 hover:bg-blue-50/60'
                      : 'opacity-40 hover:opacity-50'
                    : 'hover:bg-muted/30',
                )}
              >
                {/* Shopify order # */}
                <TableCell className="px-3 py-[7px]">
                  <Badge variant="blue" className={badgeCompact}>
                    {item.shopifyOrderNumber}
                  </Badge>
                </TableCell>

                {/* Product */}
                <TableCell className="px-3 py-[7px]">
                  <div className="flex gap-2 min-w-0">
                    <LineItemThumb imageUrl={item.imageUrl} label={formatProductLabel(item)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] leading-tight">
                        {formatProductLabel(item)}
                        {item.isCustom && (
                          <span className="text-[9px] text-muted-foreground ml-1">
                            (custom)
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground">
                        {item.sku ?? '—'}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Ref */}
                <TableCell className="px-3 py-[7px] text-[9px] font-mono text-muted-foreground">
                  {item.supplierRef ?? '—'}
                </TableCell>

                {/* Price */}
                <TableCell className="px-3 py-[7px] text-[11px]">
                  {editable ? (
                    <Input
                      className="h-7 text-[11px]"
                      value={item.itemPrice ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditLines((prev) =>
                          prev.map((d) =>
                            d._local === row._local ? { ...d, itemPrice: v || null } : d,
                          ),
                        );
                      }}
                    />
                  ) : (
                    formatItemPrice(item.itemPrice, purchaseOrder.currency)
                  )}
                </TableCell>

                <TableCell className="px-3 py-[7px] text-[11px]">
                  {editable ? (
                    <Input
                      className="h-7 text-[11px]"
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setEditLines((prev) =>
                          prev.map((d) =>
                            d._local === row._local
                              ? { ...d, quantity: Number.isFinite(n) ? Math.max(0, n) : 0 }
                              : d,
                          ),
                        );
                      }}
                    />
                  ) : (
                    item.quantity
                  )}
                </TableCell>

                <TableCell
                  className={cn(
                    'px-3 py-[7px] text-[11px] font-medium',
                    !fulfillMode && recvCellTone(item.fulfillmentStatus),
                  )}
                >
                  {fulfillMode ? (
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={recvValues[item.id] ?? item.quantityReceived}
                      disabled={rowDisabled}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setRecv(item.id, isNaN(v) ? 0 : v);
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-12 h-auto min-h-0 text-[11px] px-1 py-[2px] text-center md:text-[11px] disabled:opacity-30"
                    />
                  ) : (
                    <span className={recvCellTone(item.fulfillmentStatus)}>
                      {item.quantityReceived === 0 ? '—' : item.quantityReceived}
                    </span>
                  )}
                </TableCell>

                <TableCell className="px-3 py-[7px]">
                  <StatusBadge status={item.fulfillmentStatus} />
                </TableCell>

                {orderEditMode && (
                  <TableCell className="px-3 py-[7px] text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-[10px] h-7 text-destructive"
                      onClick={() => {
                        if (row.shopifyLineItemGid) {
                          setEditLines((prev) =>
                            prev.map((d) =>
                              d._local === row._local ? { ...d, _removed: true } : d,
                            ),
                          );
                        } else {
                          setEditLines((prev) => prev.filter((d) => d._local !== row._local));
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                )}

                {fulfillMode && (
                  <TableCell className="px-3 py-[7px] text-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(item.id)}
                      className="h-3 w-3 cursor-pointer accent-foreground"
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Add PO line (Shopify)</DialogTitle>
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
                    if (e.key === 'Enter') void runProductSearch();
                  }}
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => void runProductSearch()}>
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
                      onClick={() => addSearchHitToPo(h)}
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
                <Button type="button" onClick={addCustomLineToPo}>
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

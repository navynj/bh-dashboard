/**
 * Mapping layer: Prisma query results → UI view-model types used by Office components.
 *
 * Uses the new Shopify-first schema: fulfillment status comes from
 * ShopifyOrder.displayFulfillmentStatus stored in DB, not from live API calls.
 */

import type { Prisma } from '@prisma/client';
import type { ShopifyOrderDisplayFulfillmentStatus } from '@/types/shopify';
import type {
  OfficePurchaseOrderBlock,
  PoLineItemView,
  PoPanelMeta,
  PurchaseOrderStatus,
  LinkedShopifyOrder,
} from '../types';

// ─── Prisma payload types ─────────────────────────────────────────────────────

export type PrismaPoWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: {
    lineItems: {
      include: {
        shopifyOrderLineItem: true;
      };
    };
    shopifyOrders: { include: { customer: true } };
    supplier: true;
  };
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decimalToString(d: Prisma.Decimal | null | undefined): string | null {
  if (d == null) return null;
  return typeof d === 'object' && 'toFixed' in d
    ? (d as Prisma.Decimal).toFixed(2)
    : String(d);
}

function dateToIso(d: Date | null | undefined): string | null {
  if (d == null) return null;
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Derive PO status from linked Shopify order fulfillment:
 * - `completed`            — PO explicitly marked complete (`completedAt` set) AND all fulfilled
 * - `fulfilled`            — all linked Shopify orders fulfilled
 * - `partially_fulfilled`  — some (but not all) linked orders fulfilled
 * - `unfulfilled`          — none fulfilled, or no linked orders
 */
export function derivePurchaseOrderStatus(
  linkedOrders: { displayFulfillmentStatus: string | null }[],
  completedAt: Date | null | undefined,
): PurchaseOrderStatus {
  const total = linkedOrders.length;
  const fulfilledCount = linkedOrders.filter(
    (o) => o.displayFulfillmentStatus === 'FULFILLED',
  ).length;

  const allFulfilled = total > 0 && fulfilledCount === total;

  if (completedAt && allFulfilled) return 'completed';
  if (allFulfilled) return 'fulfilled';
  if (fulfilledCount > 0) return 'partially_fulfilled';
  return 'unfulfilled';
}

// ─── PO → OfficePurchaseOrderBlock ────────────────────────────────────────────

export function mapPrismaPoToBlock(
  po: PrismaPoWithRelations,
): OfficePurchaseOrderBlock {
  const storedStatus = po.status as PurchaseOrderStatus;
  const linkedOrders = po.shopifyOrders;
  const firstOrder = linkedOrders[0];
  const firstOrderName = firstOrder?.name ?? '—';

  // Build orderId→order map so we can resolve each lineItem's source order
  // without a 3-depth nested include (shopifyOrderLineItem→order).
  const orderById = new Map(linkedOrders.map((o) => [o.id, o]));

  const derivedFromShopify = derivePurchaseOrderStatus(
    linkedOrders.map((o) => ({ displayFulfillmentStatus: o.displayFulfillmentStatus })),
    po.completedAt,
  );

  const poConsideredFulfilled =
    derivedFromShopify === 'fulfilled' ||
    derivedFromShopify === 'completed' ||
    storedStatus === 'fulfilled' ||
    storedStatus === 'completed';

  function lineFulfillmentStatus(li: (typeof po.lineItems)[0]): ShopifyOrderDisplayFulfillmentStatus {
    const qty = li.quantity;
    const recv = li.quantityReceived;
    if (qty > 0 && recv >= qty) return 'FULFILLED';
    if (qty > 0 && recv > 0 && recv < qty) return 'PARTIALLY_FULFILLED';
    if (poConsideredFulfilled && qty > 0) return 'FULFILLED';
    return 'UNFULFILLED';
  }

  const lineItems: PoLineItemView[] = po.lineItems.map((li) => {
    const soli = li.shopifyOrderLineItem;
    const srcOrder = soli ? orderById.get(soli.orderId) : undefined;
    return {
      id: li.id,
      purchaseOrderId: li.purchaseOrderId,
      sequence: li.sequence,
      quantity: li.quantity,
      quantityReceived: li.quantityReceived,
      supplierRef: li.supplierRef,
      sku: li.sku,
      variantTitle: li.variantTitle,
      productTitle: li.productTitle,
      imageUrl: soli?.imageUrl ?? null,
      isCustom: li.isCustom,
      itemPrice: decimalToString(li.itemPrice),
      shopifyOrderLineItemId: soli?.id ?? null,
      shopifyLineItemGid: soli?.shopifyGid ?? null,
      shopifyVariantGid: li.shopifyVariantGid ?? soli?.variantGid ?? null,
      shopifyProductGid: li.shopifyProductGid ?? null,
      shopifyOrderId: srcOrder?.id ?? firstOrder?.id ?? null,
      shopifyOrderNumber: srcOrder?.name ?? firstOrderName,
      fulfillmentStatus: lineFulfillmentStatus(li),
    };
  });

  const orderDates = linkedOrders
    .map((o) => o.processedAt ?? o.shopifyCreatedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const orderedAt = orderDates.length > 0 ? dateToIso(orderDates[0]) : null;

  const linkedShopifyOrders: LinkedShopifyOrder[] = linkedOrders.map((o) => ({
    id: o.id,
    name: o.name,
    customerName: o.customer?.displayName ?? o.customer?.email ?? null,
    fulfillmentStatus: o.displayFulfillmentStatus,
  }));

  const syncDates = linkedOrders
    .map((o) => o.syncedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastSyncedAt = syncDates.length > 0 ? syncDates[0].toISOString() : null;

  /** Match PoTable: counts are **line rows** with status FULFILLED, not sum of quantities. */
  const linesFulfilled = lineItems.filter((i) => i.fulfillmentStatus === 'FULFILLED').length;
  const linesTotal = lineItems.length;

  const panelMeta: PoPanelMeta = {
    poNumber: po.poNumber,
    status: storedStatus,
    currency: po.currency,
    orderedAt,
    dateCreated: dateToIso(po.dateCreated),
    expectedDate: dateToIso(po.expectedDate),
    fulfillDoneCount: linesFulfilled,
    fulfillPendingCount: linesTotal - linesFulfilled,
    fulfillTotalCount: linesTotal,
    linkedShopifyOrders,
    lastSyncedAt,
    shippingAddress: (po.shippingAddress ?? null) as PoPanelMeta['shippingAddress'],
    billingAddress: (po.billingAddress ?? null) as PoPanelMeta['billingAddress'],
    billingSameAsShipping: po.billingSameAsShipping,
  };

  return {
    id: po.id,
    poNumber: po.poNumber,
    status: storedStatus,
    currency: po.currency,
    isAuto: po.isAuto,
    title: `Items for PO`,
    shopifyOrderCount: linkedOrders.length,
    lineItems,
    panelMeta,
  };
}

// ─── Utility: format Decimal as display currency ─────────────────────────────

export function formatItemPrice(
  raw: string | null,
  currency = 'CAD',
): string {
  if (raw == null) return '—';
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(n);
  } catch {
    return `${raw} ${currency}`;
  }
}

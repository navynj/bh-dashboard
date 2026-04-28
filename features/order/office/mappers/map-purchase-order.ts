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
  PoPanelMeta,
  PurchaseOrderStatus,
  LinkedShopifyOrder,
  PoEmailDeliveryItem,
} from '../types';
import { derivePurchaseOrderStatusFromShopify } from '@/lib/order/purchase-order-status-compute';
import { legacyFallbackOrderChannel } from '@/lib/order/supplier-order-channel';
import { sortPoLineItemsByProductTitleAsc } from '../utils/sort-lines-by-product-title';
import { minExpectedDateYmdFromShopifyOrders } from '@/lib/order/min-expected-date-ymd-from-shopify-orders';
import { toOrderedAtIso } from '../utils/vancouver-datetime';
import { computeEmailDeliveryOutstanding } from '../utils/po-email-delivery-policy';

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
    emailDeliveries: true;
  };
}>;

/** Slim variant — no lineItems, uses _count for total. Use with mapPrismaPoToSlimBlock. */
export type PrismaPoSlimWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: {
    _count: { select: { lineItems: true } };
    shopifyOrders: { include: { customer: true } };
    supplier: true;
    emailDeliveries: true;
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

export const derivePurchaseOrderStatus = derivePurchaseOrderStatusFromShopify;

// ─── PO → OfficePurchaseOrderBlock ────────────────────────────────────────────

export function mapPrismaPoToBlock(
  po: PrismaPoWithRelations,
  variantImageFallback?: Map<string, string | null>,
): OfficePurchaseOrderBlock {
  const storedStatus = po.status as PurchaseOrderStatus;
  const linkedOrders = po.shopifyOrders;
  const firstOrder = linkedOrders[0];
  const firstOrderName = firstOrder?.name ?? '—';

  const supplierChannel = legacyFallbackOrderChannel({
    orderChannelType: po.supplier.orderChannelType,
    orderChannelPayload: po.supplier.orderChannelPayload,
    contactEmails: po.supplier.contactEmails,
    contactName: po.supplier.contactName,
    link: po.supplier.link,
    notes: po.supplier.notes,
  });
  const supplierOrderChannelType = supplierChannel.type;
  const emailDeliveryOutstanding = computeEmailDeliveryOutstanding({
    supplierOrderChannelType,
    emailSentAt: po.emailSentAt,
    archivedAt: po.archivedAt,
    legacyExternalId: po.legacyExternalId,
    emailDeliveryWaivedAt: po.emailDeliveryWaivedAt,
  });

  // Build orderId→order map so we can resolve each lineItem's source order
  // without a 3-depth nested include (shopifyOrderLineItem→order).
  const orderById = new Map(linkedOrders.map((o) => [o.id, o]));

  const derivedFromShopify = derivePurchaseOrderStatusFromShopify(
    linkedOrders.map((o) => ({
      displayFulfillmentStatus: o.displayFulfillmentStatus,
    })),
    po.completedAt,
  );

  const poConsideredFulfilled =
    derivedFromShopify === 'fulfilled' ||
    derivedFromShopify === 'completed' ||
    storedStatus === 'fulfilled' ||
    storedStatus === 'completed';

  function lineFulfillmentStatus(
    li: (typeof po.lineItems)[0],
  ): ShopifyOrderDisplayFulfillmentStatus {
    const qty = li.quantity;
    const recv = li.quantityReceived;
    if (qty <= 0) return 'FULFILLED';
    if (qty > 0 && recv >= qty) return 'FULFILLED';
    if (qty > 0 && recv > 0 && recv < qty) return 'PARTIALLY_FULFILLED';
    if (poConsideredFulfilled && qty > 0) return 'FULFILLED';
    return 'UNFULFILLED';
  }

  const lineItems = sortPoLineItemsByProductTitleAsc(
    po.lineItems.map((li) => {
      const soli = li.shopifyOrderLineItem;
      /** Must match the Shopify order that owns this line (for `/apply-edit` routing). */
      const owningOrder = soli
        ? orderById.get(soli.orderId) ?? linkedOrders.find((o) => o.id === soli.orderId)
        : undefined;
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
        imageUrl: soli?.imageUrl ?? (li.shopifyVariantGid ? (variantImageFallback?.get(li.shopifyVariantGid) ?? null) : null),
        isCustom: li.isCustom,
        itemPrice: decimalToString(li.itemPrice),
        itemCost: decimalToString(soli?.unitCost ?? null),
        shopifyOrderLineItemId: soli?.id ?? null,
        shopifyLineItemGid: soli?.shopifyGid ?? null,
        shopifyVariantGid: li.shopifyVariantGid ?? soli?.variantGid ?? null,
        shopifyProductGid: li.shopifyProductGid ?? soli?.productGid ?? null,
        shopifyOrderId: soli?.orderId ?? null,
        shopifyOrderNumber: owningOrder?.name ?? firstOrderName,
        fulfillmentStatus: lineFulfillmentStatus(li),
        note: li.note?.trim() ? li.note.trim() : null,
      };
    }),
  );

  const orderDates = linkedOrders
    .map((o) => o.processedAt ?? o.shopifyCreatedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const orderedAt =
    orderDates.length > 0 ? toOrderedAtIso(orderDates[0]) : null;

  const linkedShopifyOrders: LinkedShopifyOrder[] = linkedOrders.map((o) => ({
    id: o.id,
    name: o.name,
    customerName: o.customer?.displayName ?? o.customer?.email ?? null,
    fulfillmentStatus: o.displayFulfillmentStatus,
    customerNote: o.customerNote?.trim() ? o.customerNote.trim() : null,
  }));

  const minExpectedDateYmd = minExpectedDateYmdFromShopifyOrders(linkedOrders);

  const syncDates = linkedOrders
    .map((o) => o.syncedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastSyncedAt = syncDates.length > 0 ? syncDates[0].toISOString() : null;

  /** Match PoTable: counts are **line rows** with status FULFILLED, not sum of quantities. */
  const linesFulfilled = lineItems.filter(
    (i) => i.fulfillmentStatus === 'FULFILLED',
  ).length;
  const linesTotal = lineItems.length;

  const panelMeta: PoPanelMeta = {
    poNumber: po.poNumber,
    status: storedStatus,
    currency: po.currency,
    orderedAt,
    dateCreated: dateToIso(po.dateCreated),
    expectedDate: dateToIso(po.expectedDate),
    comment: po.comment?.trim() ? po.comment.trim() : null,
    minExpectedDateYmd,
    fulfillDoneCount: linesFulfilled,
    fulfillPendingCount: linesTotal - linesFulfilled,
    fulfillTotalCount: linesTotal,
    linkedShopifyOrders,
    lastSyncedAt,
    shippingAddress: (po.shippingAddress ??
      null) as PoPanelMeta['shippingAddress'],
    billingAddress: (po.billingAddress ??
      null) as PoPanelMeta['billingAddress'],
    billingSameAsShipping: po.billingSameAsShipping,
    authorizedBy: po.authorizedBy?.trim() ?? null,
    emailSentAt: po.emailSentAt ? po.emailSentAt.toISOString() : null,
    emailReplyReceivedAt: po.emailReplyReceivedAt ? po.emailReplyReceivedAt.toISOString() : null,
    emailDeliveryWaivedAt: po.emailDeliveryWaivedAt
      ? po.emailDeliveryWaivedAt.toISOString()
      : null,
    emailDeliveries: po.emailDeliveries.map((d): PoEmailDeliveryItem => ({
      recipientEmail: d.recipientEmail,
      recipientName: d.recipientName,
      sentAt: d.sentAt.toISOString(),
    })),
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
    archivedAt: po.archivedAt ? po.archivedAt.toISOString() : null,
    panelMeta,
    supplierOrderChannelType,
    poCreatedAt: po.createdAt.toISOString(),
    legacyExternalId: po.legacyExternalId,
    emailDeliveryOutstanding,
  };
}

/**
 * Slim variant of mapPrismaPoToBlock — no lineItems fetched; returns lineItems: []
 * (lazy-loaded client-side). Uses pre-computed lineCounts for panelMeta counts.
 * Keep in sync with mapPrismaPoToBlock when changing shared logic.
 */
export function mapPrismaPoToSlimBlock(
  po: PrismaPoSlimWithRelations,
  lineCounts: { total: number; done: number },
): OfficePurchaseOrderBlock {
  const storedStatus = po.status as PurchaseOrderStatus;
  const linkedOrders = po.shopifyOrders;
  const firstOrder = linkedOrders[0];
  const firstOrderName = firstOrder?.name ?? '—';

  const supplierChannel = legacyFallbackOrderChannel({
    orderChannelType: po.supplier.orderChannelType,
    orderChannelPayload: po.supplier.orderChannelPayload,
    contactEmails: po.supplier.contactEmails,
    contactName: po.supplier.contactName,
    link: po.supplier.link,
    notes: po.supplier.notes,
  });
  const supplierOrderChannelType = supplierChannel.type;
  const emailDeliveryOutstanding = computeEmailDeliveryOutstanding({
    supplierOrderChannelType,
    emailSentAt: po.emailSentAt,
    archivedAt: po.archivedAt,
    legacyExternalId: po.legacyExternalId,
    emailDeliveryWaivedAt: po.emailDeliveryWaivedAt,
  });

  const orderById = new Map(linkedOrders.map((o) => [o.id, o]));
  void orderById;

  const derivedFromShopify = derivePurchaseOrderStatusFromShopify(
    linkedOrders.map((o) => ({
      displayFulfillmentStatus: o.displayFulfillmentStatus,
    })),
    po.completedAt,
  );

  const poConsideredFulfilled =
    derivedFromShopify === 'fulfilled' ||
    derivedFromShopify === 'completed' ||
    storedStatus === 'fulfilled' ||
    storedStatus === 'completed';

  const linesTotal = lineCounts.total;
  const linesFulfilled = poConsideredFulfilled ? linesTotal : lineCounts.done;

  const orderDates = linkedOrders
    .map((o) => o.processedAt ?? o.shopifyCreatedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const orderedAt =
    orderDates.length > 0 ? toOrderedAtIso(orderDates[0]) : null;

  const linkedShopifyOrders: LinkedShopifyOrder[] = linkedOrders.map((o) => ({
    id: o.id,
    name: o.name,
    customerName: o.customer?.displayName ?? o.customer?.email ?? null,
    fulfillmentStatus: o.displayFulfillmentStatus,
    customerNote: o.customerNote?.trim() ? o.customerNote.trim() : null,
  }));

  const minExpectedDateYmd = minExpectedDateYmdFromShopifyOrders(linkedOrders);

  const syncDates = linkedOrders
    .map((o) => o.syncedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastSyncedAt = syncDates.length > 0 ? syncDates[0].toISOString() : null;

  const panelMeta: PoPanelMeta = {
    poNumber: po.poNumber,
    status: storedStatus,
    currency: po.currency,
    orderedAt,
    dateCreated: dateToIso(po.dateCreated),
    expectedDate: dateToIso(po.expectedDate),
    comment: po.comment?.trim() ? po.comment.trim() : null,
    minExpectedDateYmd,
    fulfillDoneCount: linesFulfilled,
    fulfillPendingCount: linesTotal - linesFulfilled,
    fulfillTotalCount: linesTotal,
    linkedShopifyOrders,
    lastSyncedAt,
    shippingAddress: (po.shippingAddress ?? null) as PoPanelMeta['shippingAddress'],
    billingAddress: (po.billingAddress ?? null) as PoPanelMeta['billingAddress'],
    billingSameAsShipping: po.billingSameAsShipping,
    authorizedBy: po.authorizedBy?.trim() ?? null,
    emailSentAt: po.emailSentAt ? po.emailSentAt.toISOString() : null,
    emailReplyReceivedAt: po.emailReplyReceivedAt ? po.emailReplyReceivedAt.toISOString() : null,
    emailDeliveryWaivedAt: po.emailDeliveryWaivedAt
      ? po.emailDeliveryWaivedAt.toISOString()
      : null,
    emailDeliveries: po.emailDeliveries.map((d): PoEmailDeliveryItem => ({
      recipientEmail: d.recipientEmail,
      recipientName: d.recipientName,
      sentAt: d.sentAt.toISOString(),
    })),
  };

  return {
    id: po.id,
    poNumber: po.poNumber,
    status: storedStatus,
    currency: po.currency,
    isAuto: po.isAuto,
    title: `Items for PO`,
    shopifyOrderCount: linkedOrders.length,
    lineItems: [],
    archivedAt: po.archivedAt ? po.archivedAt.toISOString() : null,
    panelMeta,
    supplierOrderChannelType,
    poCreatedAt: po.createdAt.toISOString(),
    legacyExternalId: po.legacyExternalId,
    emailDeliveryOutstanding,
  };
}

// ─── Utility: format Decimal as display currency ─────────────────────────────

export function formatItemPrice(raw: string | null, currency = 'CAD'): string {
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

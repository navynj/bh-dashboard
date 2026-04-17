/**
 * After a Shopify order sync, refresh `PurchaseOrderLineItem` rows that point at
 * `ShopifyOrderLineItem` records, and optionally append new PO lines for unlinked
 * lines on a chosen linked Shopify order.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/prisma';
import { recomputePurchaseOrderStatusById } from '@/lib/order/purchase-order-status';

export type ResyncPurchaseOrderFromShopifyOptions = {
  purchaseOrderId: string;
  /** Local `ShopifyOrder.id` — only lines on this order are considered for append. */
  appendFromShopifyOrderId?: string | null;
};

function toDecimal(n: Prisma.Decimal | number | null | undefined): Prisma.Decimal | null {
  if (n == null) return null;
  if (n instanceof Prisma.Decimal) return n;
  return new Prisma.Decimal(n);
}

async function deletePoliIfNoFinalizedFulfillments(purchaseOrderLineItemId: string): Promise<boolean> {
  const finalized = await prisma.fulfillmentLineItem.count({
    where: {
      purchaseOrderLineItemId,
      finalizedAt: { not: null },
    },
  });
  if (finalized > 0) return false;
  await prisma.fulfillmentLineItem.deleteMany({
    where: { purchaseOrderLineItemId },
  });
  await prisma.purchaseOrderLineItem.delete({
    where: { id: purchaseOrderLineItemId },
  });
  return true;
}

export async function resyncPurchaseOrderLineItemsFromShopify(
  options: ResyncPurchaseOrderFromShopifyOptions,
): Promise<void> {
  const { purchaseOrderId, appendFromShopifyOrderId } = options;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      supplier: { select: { shopifyVendorName: true } },
      lineItems: { orderBy: { sequence: 'asc' } },
      shopifyOrders: { select: { id: true } },
    },
  });
  if (!po) return;

  const linkedOrderIds = new Set(po.shopifyOrders.map((o) => o.id));
  const vendorNorm = po.supplier.shopifyVendorName?.trim().toLowerCase() ?? null;

  for (const poli of po.lineItems) {
    if (!poli.shopifyOrderLineItemId) continue;
    const soli = await prisma.shopifyOrderLineItem.findUnique({
      where: { id: poli.shopifyOrderLineItemId },
    });
    if (!soli) {
      await deletePoliIfNoFinalizedFulfillments(poli.id);
      continue;
    }
    if (!linkedOrderIds.has(soli.orderId)) {
      continue;
    }

    const price = soli.price;
    const qty = soli.quantity;
    const subtotal =
      price != null ? new Prisma.Decimal(price).mul(qty) : null;

    await prisma.purchaseOrderLineItem.update({
      where: { id: poli.id },
      data: {
        quantity: qty,
        sku: soli.sku,
        variantTitle: soli.variantTitle,
        productTitle: soli.title,
        itemPrice: price,
        lineSubtotalPrice: subtotal,
        shopifyVariantGid: soli.variantGid,
        isCustom: !soli.variantGid,
      },
    });
  }

  if (!appendFromShopifyOrderId || !linkedOrderIds.has(appendFromShopifyOrderId)) {
    await recomputePurchaseOrderStatusById(purchaseOrderId);
    return;
  }

  const refreshed = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      lineItems: { orderBy: { sequence: 'asc' } },
    },
  });
  if (!refreshed) {
    await recomputePurchaseOrderStatusById(purchaseOrderId);
    return;
  }

  const usedShopifyLineIds = new Set(
    refreshed.lineItems.map((l) => l.shopifyOrderLineItemId).filter(Boolean) as string[],
  );

  const orderWithLines = await prisma.shopifyOrder.findUnique({
    where: { id: appendFromShopifyOrderId },
    include: { lineItems: { orderBy: { createdAt: 'asc' } } },
  });
  if (!orderWithLines) {
    await recomputePurchaseOrderStatusById(purchaseOrderId);
    return;
  }

  let maxSeq = refreshed.lineItems.reduce((m, l) => Math.max(m, l.sequence), 0);

  for (const li of orderWithLines.lineItems) {
    if (li.quantity <= 0) continue;
    if (usedShopifyLineIds.has(li.id)) continue;
    if (vendorNorm) {
      const v = li.vendor?.trim().toLowerCase() ?? '';
      if (v && v !== vendorNorm) continue;
    }

    maxSeq += 1;
    const price = li.price;
    const subtotal =
      price != null ? new Prisma.Decimal(price).mul(li.quantity) : null;

    await prisma.purchaseOrderLineItem.create({
      data: {
        purchaseOrderId,
        sequence: maxSeq,
        quantity: li.quantity,
        quantityReceived: 0,
        sku: li.sku,
        variantTitle: li.variantTitle,
        productTitle: li.title ?? '(untitled)',
        shopifyOrderLineItemId: li.id,
        shopifyVariantGid: li.variantGid,
        isCustom: !li.variantGid,
        itemPrice: toDecimal(price),
        lineSubtotalPrice: subtotal,
      },
    });
    usedShopifyLineIds.add(li.id);
  }

  await recomputePurchaseOrderStatusById(purchaseOrderId);
}

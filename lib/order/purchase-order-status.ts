import type { Prisma } from '@prisma/client';
import type { PurchaseOrderStatus } from '@/features/order/office/types/purchase-order';
import { prisma } from '@/lib/core/prisma';
import { computePurchaseOrderStatus } from '@/lib/order/purchase-order-status-compute';

export type {
  PoStatusComputationInput,
} from '@/lib/order/purchase-order-status-compute';
export {
  computePurchaseOrderStatus,
  derivePurchaseOrderStatusFromShopify,
} from '@/lib/order/purchase-order-status-compute';

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Recompute and persist `PurchaseOrder.status` (and `receivedAt` when every line
 * is fully received) from Shopify + line quantities.
 */
export async function recomputePurchaseOrderStatusById(
  purchaseOrderId: string,
  db: DbClient = prisma,
): Promise<PurchaseOrderStatus | null> {
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      status: true,
      completedAt: true,
      receivedAt: true,
      lineItems: { select: { quantity: true, quantityReceived: true } },
      shopifyOrders: { select: { displayFulfillmentStatus: true } },
    },
  });
  if (!po) return null;

  const substantive = po.lineItems.filter((l) => l.quantity > 0);
  const lineAllFulfilled =
    substantive.length > 0 &&
    substantive.every((l) => l.quantityReceived >= l.quantity);

  const next = computePurchaseOrderStatus({
    status: po.status,
    completedAt: po.completedAt,
    lineItems: po.lineItems,
    shopifyOrders: po.shopifyOrders,
  });

  const needReceivedAt =
    next === 'fulfilled' && lineAllFulfilled && !po.receivedAt;
  if (next === po.status && !needReceivedAt) return next;

  await db.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      status: next,
      ...(next === 'fulfilled' && lineAllFulfilled && !po.receivedAt
        ? { receivedAt: new Date() }
        : {}),
    },
  });
  return next;
}

export async function recomputePurchaseOrderStatusesForShopifyOrderId(
  shopifyOrderId: string,
  db: DbClient = prisma,
): Promise<void> {
  const pos = await db.purchaseOrder.findMany({
    where: { shopifyOrders: { some: { id: shopifyOrderId } } },
    select: { id: true },
  });
  for (const p of pos) {
    await recomputePurchaseOrderStatusById(p.id, db);
  }
}

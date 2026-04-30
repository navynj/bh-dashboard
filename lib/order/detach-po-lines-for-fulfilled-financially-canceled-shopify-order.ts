import { prisma } from '@/lib/core/prisma';
import { deletePurchaseOrderLineItemIfNoFinalizedFulfillments } from '@/lib/order/purchase-order-line-item-delete-if-safe';

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase();
}

/**
 * Shopify can still show {@link displayFulfillmentStatus} `FULFILLED` after a
 * customer order is voided/refunded. Those lines should not remain on supplier POs.
 */
export function shouldDetachPoLinesAfterFulfilledOrderFinanciallyCanceled(params: {
  displayFulfillmentStatus: string | null | undefined;
  displayFinancialStatus: string | null | undefined;
}): boolean {
  if (norm(params.displayFulfillmentStatus) !== 'FULFILLED') return false;
  const fin = norm(params.displayFinancialStatus);
  return fin === 'VOIDED' || fin === 'REFUNDED';
}

/**
 * Removes `PurchaseOrderLineItem` rows linked to this Shopify order (when safe),
 * then disconnects the Shopify order from any PO that no longer references its lines.
 *
 * @returns Distinct `purchaseOrder.id` values that were touched (for status recompute).
 */
export async function detachPoLinesForFulfilledFinanciallyCanceledShopifyOrder(
  shopifyOrderId: string,
  displayFulfillmentStatus: string | null | undefined,
  displayFinancialStatus: string | null | undefined,
): Promise<string[]> {
  if (
    !shouldDetachPoLinesAfterFulfilledOrderFinanciallyCanceled({
      displayFulfillmentStatus,
      displayFinancialStatus,
    })
  ) {
    return [];
  }

  const polis = await prisma.purchaseOrderLineItem.findMany({
    where: {
      shopifyOrderLineItem: { orderId: shopifyOrderId },
    },
    select: { id: true, purchaseOrderId: true },
  });
  if (polis.length === 0) return [];

  const touchedPoIds = new Set<string>();
  const removalFlags = await Promise.all(
    polis.map((row) =>
      deletePurchaseOrderLineItemIfNoFinalizedFulfillments(row.id).then((removed) => ({
        removed,
        purchaseOrderId: row.purchaseOrderId,
      })),
    ),
  );
  for (const { removed, purchaseOrderId } of removalFlags) {
    if (removed) touchedPoIds.add(purchaseOrderId);
  }

  const candidatePoIds = [...new Set(polis.map((p) => p.purchaseOrderId))];
  await Promise.all(
    candidatePoIds.map(async (poId) => {
      const remaining = await prisma.purchaseOrderLineItem.count({
        where: {
          purchaseOrderId: poId,
          shopifyOrderLineItem: { orderId: shopifyOrderId },
        },
      });
      if (remaining === 0) {
        await prisma.purchaseOrder.update({
          where: { id: poId },
          data: {
            shopifyOrders: { disconnect: { id: shopifyOrderId } },
          },
        });
        touchedPoIds.add(poId);
      }
    }),
  );

  return [...touchedPoIds];
}

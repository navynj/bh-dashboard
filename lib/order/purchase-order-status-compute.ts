import type { PurchaseOrderStatus } from '@/features/order/office/types/purchase-order';

export type PoStatusComputationInput = {
  /** Current row status (used to preserve `completed` when `completedAt` is set). */
  status: string;
  completedAt: Date | null;
  lineItems: { quantity: number; quantityReceived: number }[];
  shopifyOrders: { displayFulfillmentStatus: string | null }[];
};

/**
 * Derive PO status from linked Shopify order fulfillment:
 * - `completed`            — PO explicitly marked complete (`completedAt` set) AND all linked orders fulfilled
 * - `fulfilled`            — all linked Shopify orders fulfilled
 * - `partially_fulfilled`  — some (but not all) linked orders fulfilled
 * - `unfulfilled`          — none fulfilled, or no linked orders
 */
export function derivePurchaseOrderStatusFromShopify(
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

/**
 * Single source of truth for persisted `PurchaseOrder.status`: combines Shopify
 * fulfillment on linked orders with received quantities on PO lines (matches
 * how `mapPrismaPoToBlock` infers line fulfillment for the office UI).
 */
export function computePurchaseOrderStatus(
  input: PoStatusComputationInput,
): PurchaseOrderStatus {
  const shopifyDerived = derivePurchaseOrderStatusFromShopify(
    input.shopifyOrders,
    input.completedAt,
  );

  const substantive = input.lineItems.filter((l) => l.quantity > 0);
  const lineAllFulfilled =
    substantive.length > 0 &&
    substantive.every((l) => l.quantityReceived >= l.quantity);
  const lineAnyPartial = substantive.some(
    (l) => l.quantityReceived > 0 && l.quantityReceived < l.quantity,
  );
  const lineAnyRecv = substantive.some((l) => l.quantityReceived > 0);

  let next: PurchaseOrderStatus;
  if (shopifyDerived === 'completed') {
    next = 'completed';
  } else if (shopifyDerived === 'fulfilled' || lineAllFulfilled) {
    next = 'fulfilled';
  } else if (
    shopifyDerived === 'partially_fulfilled' ||
    lineAnyPartial ||
    lineAnyRecv
  ) {
    next = 'partially_fulfilled';
  } else {
    next = 'unfulfilled';
  }

  if (input.status === 'completed' && input.completedAt != null) {
    next = 'completed';
  }

  return next;
}

import type { PrismaClient } from '@prisma/client';

/**
 * PO lines from CSV / legacy import: no `shopify_order_line_item_id`, so Inbox
 * “open qty” SQL does not see them. Qty is spread onto inbox candidate Shopify
 * lines (same variant GID, else SKU) for orders linked to that PO — including
 * when the PO links to multiple Shopify orders (FIFO across linked candidates).
 */
export type LegacyOrphanPoLineForInbox = {
  quantity: number;
  shopifyVariantGid: string | null;
  sku: string | null;
  purchaseOrder: {
    id: string;
    shopifyOrders: { id: string }[];
  };
};

export async function fetchLegacyOrphanPoLinesForInbox(
  prisma: PrismaClient,
  shopifyOrderIds: string[],
): Promise<LegacyOrphanPoLineForInbox[]> {
  if (shopifyOrderIds.length === 0) return [];
  return prisma.purchaseOrderLineItem.findMany({
    where: {
      shopifyOrderLineItemId: null,
      quantity: { gt: 0 },
      purchaseOrder: {
        /** Archived PO lines still “claim” inbox capacity (same as FK’d lines). */
        shopifyOrders: { some: { id: { in: shopifyOrderIds } } },
      },
    },
    select: {
      quantity: true,
      shopifyVariantGid: true,
      sku: true,
      purchaseOrder: {
        select: {
          id: true,
          shopifyOrders: { select: { id: true } },
        },
      },
    },
  });
}

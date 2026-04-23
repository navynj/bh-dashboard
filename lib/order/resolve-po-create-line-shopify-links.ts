import type { Prisma } from '@prisma/client';

export type PoCreateLineShopifyInput = {
  sku?: string | null;
  shopifyLineItemId?: string | null;
  shopifyLineItemGid?: string | null;
  shopifyVariantGid?: string | null;
};

type Tx = Prisma.TransactionClient;

/**
 * Resolves `ShopifyOrderLineItem.id` for each PO create line and expands the set
 * of Shopify orders to connect from explicit line references (even if order refs
 * were incomplete).
 */
export async function resolvePoCreateLineShopifyLinks(
  tx: Tx,
  orderNamesFromRefs: string[],
  lineItems: PoCreateLineShopifyInput[],
): Promise<{
  shopifyOrderIds: string[];
  lineShopifyOrderLineItemIds: (string | null)[];
}> {
  const normalizedNames = [
    ...new Set(
      orderNamesFromRefs
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    ),
  ];

  const refOrders =
    normalizedNames.length > 0
      ? await tx.shopifyOrder.findMany({
          where: { name: { in: normalizedNames } },
          select: { id: true },
        })
      : [];

  const orderIdSet = new Set(refOrders.map((o) => o.id));

  for (const li of lineItems) {
    const localId = li.shopifyLineItemId?.trim();
    if (localId) {
      const row = await tx.shopifyOrderLineItem.findUnique({
        where: { id: localId },
        select: { orderId: true },
      });
      if (row) orderIdSet.add(row.orderId);
    }
    const gid = li.shopifyLineItemGid?.trim();
    if (gid) {
      const row = await tx.shopifyOrderLineItem.findUnique({
        where: { shopifyGid: gid },
        select: { orderId: true },
      });
      if (row) orderIdSet.add(row.orderId);
    }
  }

  const orderIds = [...orderIdSet];
  if (orderIds.length === 0) {
    return {
      shopifyOrderIds: [],
      lineShopifyOrderLineItemIds: lineItems.map(() => null),
    };
  }

  const allSolis = await tx.shopifyOrderLineItem.findMany({
    where: { orderId: { in: orderIds } },
    select: {
      id: true,
      orderId: true,
      shopifyGid: true,
      variantGid: true,
      sku: true,
    },
    orderBy: [{ orderId: 'asc' }, { id: 'asc' }],
  });

  const used = new Set<string>();
  const lineShopifyOrderLineItemIds: (string | null)[] = [];

  for (const li of lineItems) {
    const localId = li.shopifyLineItemId?.trim();
    if (localId) {
      const s = allSolis.find((r) => r.id === localId);
      if (s && !used.has(s.id)) {
        used.add(s.id);
        lineShopifyOrderLineItemIds.push(s.id);
        continue;
      }
    }

    const gid = li.shopifyLineItemGid?.trim();
    if (gid) {
      const s = allSolis.find((r) => r.shopifyGid === gid);
      if (s && !used.has(s.id)) {
        used.add(s.id);
        lineShopifyOrderLineItemIds.push(s.id);
        continue;
      }
    }

    const vg = li.shopifyVariantGid?.trim();
    if (vg) {
      const sku = li.sku?.trim() ?? '';
      let candidates = allSolis.filter(
        (r) => r.variantGid === vg && !used.has(r.id),
      );
      if (sku && candidates.some((c) => (c.sku?.trim() ?? '') === sku)) {
        candidates = candidates.filter((c) => (c.sku?.trim() ?? '') === sku);
      }
      const pick = candidates[0];
      if (pick) {
        used.add(pick.id);
        lineShopifyOrderLineItemIds.push(pick.id);
        continue;
      }
    }

    lineShopifyOrderLineItemIds.push(null);
  }

  return { shopifyOrderIds: orderIds, lineShopifyOrderLineItemIds };
}

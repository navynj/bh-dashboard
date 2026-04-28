import type { Prisma } from '@prisma/client';

export type PoCreateLineShopifyInput = {
  sku?: string | null;
  shopifyLineItemId?: string | null;
  shopifyLineItemGid?: string | null;
  shopifyVariantGid?: string | null;
};

type Tx = Prisma.TransactionClient;

type SoliRow = {
  id: string;
  orderId: string;
  shopifyGid: string | null;
  variantGid: string | null;
  sku: string | null;
};

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
  /** Resolved from DB when the client omitted `shopifyVariantGid` (parallel to lineItems). */
  lineResolvedVariantGids: (string | null)[];
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

  const localIds = [
    ...new Set(
      lineItems
        .map((li) => li.shopifyLineItemId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const shopifyGids = [
    ...new Set(
      lineItems
        .map((li) => li.shopifyLineItemGid?.trim())
        .filter((g): g is string => Boolean(g)),
    ),
  ];

  let linkingRows: { orderId: string }[] = [];
  if (localIds.length > 0 && shopifyGids.length > 0) {
    linkingRows = await tx.shopifyOrderLineItem.findMany({
      where: {
        OR: [{ id: { in: localIds } }, { shopifyGid: { in: shopifyGids } }],
      },
      select: { orderId: true },
    });
  } else if (localIds.length > 0) {
    linkingRows = await tx.shopifyOrderLineItem.findMany({
      where: { id: { in: localIds } },
      select: { orderId: true },
    });
  } else if (shopifyGids.length > 0) {
    linkingRows = await tx.shopifyOrderLineItem.findMany({
      where: { shopifyGid: { in: shopifyGids } },
      select: { orderId: true },
    });
  }

  for (const r of linkingRows) {
    orderIdSet.add(r.orderId);
  }

  const orderIds = [...orderIdSet];
  if (orderIds.length === 0) {
    const empty = lineItems.map(() => null as string | null);
    return {
      shopifyOrderIds: [],
      lineShopifyOrderLineItemIds: empty,
      lineResolvedVariantGids: empty,
    };
  }

  const allSolis: SoliRow[] = await tx.shopifyOrderLineItem.findMany({
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

  const idToRow = new Map(allSolis.map((r) => [r.id, r]));
  const gidToRow = new Map<string, SoliRow>();
  for (const r of allSolis) {
    const g = r.shopifyGid?.trim();
    if (g) gidToRow.set(g, r);
  }

  const byVariant = new Map<string, SoliRow[]>();
  for (const r of allSolis) {
    const vg = r.variantGid?.trim() ?? '';
    if (!vg) continue;
    const arr = byVariant.get(vg);
    if (arr) arr.push(r);
    else byVariant.set(vg, [r]);
  }

  const used = new Set<string>();
  const lineShopifyOrderLineItemIds: (string | null)[] = [];
  const lineResolvedVariantGids: (string | null)[] = [];

  for (const li of lineItems) {
    const localId = li.shopifyLineItemId?.trim();
    if (localId) {
      const s = idToRow.get(localId);
      if (s && !used.has(s.id)) {
        used.add(s.id);
        lineShopifyOrderLineItemIds.push(s.id);
        lineResolvedVariantGids.push(s.variantGid?.trim() ?? null);
        continue;
      }
    }

    const gid = li.shopifyLineItemGid?.trim();
    if (gid) {
      const s = gidToRow.get(gid);
      if (s && !used.has(s.id)) {
        used.add(s.id);
        lineShopifyOrderLineItemIds.push(s.id);
        lineResolvedVariantGids.push(s.variantGid?.trim() ?? null);
        continue;
      }
    }

    const vg = li.shopifyVariantGid?.trim();
    if (vg) {
      const sku = li.sku?.trim() ?? '';
      let candidates = (byVariant.get(vg) ?? []).filter((r) => !used.has(r.id));
      if (sku && candidates.some((c) => (c.sku?.trim() ?? '') === sku)) {
        candidates = candidates.filter((c) => (c.sku?.trim() ?? '') === sku);
      }
      const pick = candidates[0];
      if (pick) {
        used.add(pick.id);
        lineShopifyOrderLineItemIds.push(pick.id);
        lineResolvedVariantGids.push(pick.variantGid?.trim() ?? null);
        continue;
      }
    }

    lineShopifyOrderLineItemIds.push(null);
    lineResolvedVariantGids.push(null);
  }

  return { shopifyOrderIds: orderIds, lineShopifyOrderLineItemIds, lineResolvedVariantGids };
}

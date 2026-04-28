import type { OfficePurchaseOrderBlock, ShopifyOrderDraft } from '../types';

/**
 * Inbox (without_po): drop Shopify lines that are already fully on active POs.
 * Uses loaded PO `lineItems` with `shopifyOrderLineItemId` — slim PO blocks have
 * empty lines, so this is a no-op until lazy fetch fills them; drafts should
 * already carry correct remaining qty from the server.
 */
export function filterInboxDraftsForDisplay(
  drafts: ShopifyOrderDraft[] | undefined,
  purchaseOrders: OfficePurchaseOrderBlock[] | undefined,
): ShopifyOrderDraft[] {
  if (!drafts?.length) return [];

  const poQtyByShopifyLineItemId = new Map<string, number>();
  for (const po of purchaseOrders ?? []) {
    if (po.id === 'new') continue;
    if (po.archivedAt) continue;
    if (!po.lineItems?.length) continue;
    for (const li of po.lineItems) {
      const sid = li.shopifyOrderLineItemId?.trim();
      if (!sid) continue;
      poQtyByShopifyLineItemId.set(
        sid,
        (poQtyByShopifyLineItemId.get(sid) ?? 0) + (li.quantity ?? 0),
      );
    }
  }

  return drafts
    .map((order) => ({
      ...order,
      lineItems: order.lineItems.filter((li) => {
        if ((li.quantity ?? 0) <= 0) return false;
        if (poQtyByShopifyLineItemId.size === 0) return true;
        const sid = li.shopifyLineItemId?.trim();
        if (!sid) return true;
        const onPo = poQtyByShopifyLineItemId.get(sid) ?? 0;
        if (onPo <= 0) return true;
        const source = li.shopifySourceLineQty ?? li.quantity;
        return onPo < source;
      }),
    }))
    .filter((o) => o.lineItems.length > 0);
}

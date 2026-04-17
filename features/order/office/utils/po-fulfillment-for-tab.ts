import type { OfficePurchaseOrderBlock, ViewData } from '../types';

/**
 * Whether this PO is fully delivered for office tab purposes (aligned with
 * PoTable / `panelMeta` line counts, linked Shopify fulfillment, and DB status).
 */
export function isOfficePoDeliveryDone(
  po: OfficePurchaseOrderBlock,
): boolean {
  if (po.id === 'new') return false;
  if (po.status === 'fulfilled' || po.status === 'completed') return true;
  const m = po.panelMeta;
  if (m && m.fulfillTotalCount > 0 && m.fulfillPendingCount === 0) return true;
  const linked = m?.linkedShopifyOrders ?? [];
  if (
    linked.length > 0 &&
    linked.every((o) => o.fulfillmentStatus === 'FULFILLED')
  ) {
    return true;
  }
  return false;
}

export function supplierRowHasOpenDeliveryPo(vd: ViewData | undefined): boolean {
  if (!vd || vd.type !== 'post') return false;
  return vd.purchaseOrders.some(
    (p) => p.id !== 'new' && !isOfficePoDeliveryDone(p),
  );
}

/** Fulfilled tab: delivered POs that are not in the completed (invoiced) bucket. */
export function supplierRowHasFulfilledListPo(
  vd: ViewData | undefined,
): boolean {
  if (!vd || vd.type !== 'post') return false;
  return vd.purchaseOrders.some(
    (p) =>
      p.id !== 'new' &&
      isOfficePoDeliveryDone(p) &&
      p.status !== 'completed',
  );
}

/** Expected-date chips for PO Created / Fulfilled tabs (per-PO, not whole row). */
export function expectedDateKeysForPoTab(
  vd: ViewData | undefined,
  tab: 'po_created' | 'fulfilled',
): string[] {
  if (!vd || vd.type !== 'post') return [];
  const keys: string[] = [];
  for (const po of vd.purchaseOrders) {
    if (po.id === 'new') continue;
    if (tab === 'po_created' && isOfficePoDeliveryDone(po)) continue;
    if (
      tab === 'fulfilled' &&
      (!isOfficePoDeliveryDone(po) || po.status === 'completed')
    ) {
      continue;
    }
    const raw = po.panelMeta?.expectedDate;
    if (!raw) continue;
    keys.push(raw.length >= 10 ? raw.slice(0, 10) : raw);
  }
  return keys;
}

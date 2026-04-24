import type { SupplierKey, ViewData } from '../types';

export function findSupplierKeyForPurchaseOrderId(
  viewDataMap: Record<SupplierKey, ViewData>,
  purchaseOrderId: string,
): SupplierKey | null {
  for (const k of Object.keys(viewDataMap)) {
    const key = k as SupplierKey;
    const vd = viewDataMap[key];
    if (vd.type !== 'post') continue;
    if (vd.purchaseOrders.some((p) => p.id === purchaseOrderId)) return key;
  }
  return null;
}

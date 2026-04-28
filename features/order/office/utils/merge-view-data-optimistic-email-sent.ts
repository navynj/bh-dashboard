import type { ViewData, OfficePurchaseOrderBlock } from '../types';

/**
 * After a successful “send PO email” client action, patch `emailSentAt` + outstanding
 * flags until `router.refresh()` returns server truth.
 */
export function mergeViewDataWithOptimisticEmailSent(
  viewDataMap: Record<string, ViewData>,
  sentAtIsoByPoId: Record<string, string>,
): Record<string, ViewData> {
  const ids = Object.keys(sentAtIsoByPoId);
  if (ids.length === 0) return viewDataMap;

  const out: Record<string, ViewData> = { ...viewDataMap };
  let any = false;

  for (const [supplierKey, vd] of Object.entries(viewDataMap)) {
    if (vd.type !== 'post') continue;
    let touched = false;
    const purchaseOrders = vd.purchaseOrders.map((po) => {
      const sentIso = sentAtIsoByPoId[po.id];
      if (!sentIso) return po;
      touched = true;
      const next: OfficePurchaseOrderBlock = {
        ...po,
        emailDeliveryOutstanding: false,
        panelMeta: po.panelMeta
          ? {
              ...po.panelMeta,
              emailSentAt: sentIso,
              emailDeliveryWaivedAt: null,
            }
          : po.panelMeta,
      };
      return next;
    });
    if (touched) {
      any = true;
      out[supplierKey] = { ...vd, purchaseOrders };
    }
  }

  return any ? out : viewDataMap;
}

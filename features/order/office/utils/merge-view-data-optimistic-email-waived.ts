import type { ViewData, OfficePurchaseOrderBlock } from '../types';
import { computeEmailDeliveryOutstanding } from './po-email-delivery-policy';

/**
 * After “do not send” / dismiss alert, patch `emailDeliveryWaivedAt` + outstanding until refresh.
 */
export function mergeViewDataWithOptimisticEmailWaived(
  viewDataMap: Record<string, ViewData>,
  waivedAtIsoByPoId: Record<string, string>,
  clearedWaivedPoIds: ReadonlySet<string>,
): Record<string, ViewData> {
  if (
    Object.keys(waivedAtIsoByPoId).length === 0 &&
    clearedWaivedPoIds.size === 0
  ) {
    return viewDataMap;
  }

  const out: Record<string, ViewData> = { ...viewDataMap };
  let any = false;

  for (const [supplierKey, vd] of Object.entries(viewDataMap)) {
    if (vd.type !== 'post') continue;
    let touched = false;
    const purchaseOrders = vd.purchaseOrders.map((po) => {
      const cleared = clearedWaivedPoIds.has(po.id);
      const optIso = waivedAtIsoByPoId[po.id];
      const serverIso = po.panelMeta?.emailDeliveryWaivedAt ?? null;
      const nextWaivedIso = cleared ? null : optIso ?? serverIso;
      if (
        nextWaivedIso === serverIso &&
        !cleared &&
        optIso === undefined
      ) {
        return po;
      }

      const emailDeliveryOutstanding = computeEmailDeliveryOutstanding({
        supplierOrderChannelType: po.supplierOrderChannelType,
        emailSentAt: po.panelMeta?.emailSentAt
          ? new Date(po.panelMeta.emailSentAt)
          : null,
        archivedAt: undefined,
        legacyExternalId: po.legacyExternalId,
        emailDeliveryWaivedAt: nextWaivedIso ? new Date(nextWaivedIso) : null,
        purchaseOrderStatus: po.status,
      });

      touched = true;
      const next: OfficePurchaseOrderBlock = {
        ...po,
        emailDeliveryOutstanding,
        panelMeta: po.panelMeta
          ? {
              ...po.panelMeta,
              emailDeliveryWaivedAt: nextWaivedIso,
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

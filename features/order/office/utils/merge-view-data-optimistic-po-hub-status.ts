import type {
  ViewData,
  OfficePurchaseOrderBlock,
  PurchaseOrderStatus,
} from '../types';
import { computeEmailDeliveryOutstanding } from './po-email-delivery-policy';

/**
 * Patches hub `purchase_orders.status` (e.g. pending / unfulfilled) until refresh,
 * including `emailDeliveryOutstanding` when status is `pending`.
 */
export function mergeViewDataWithOptimisticPoHubStatus(
  viewDataMap: Record<string, ViewData>,
  statusByPoId: Record<string, PurchaseOrderStatus>,
): Record<string, ViewData> {
  const ids = Object.keys(statusByPoId);
  if (ids.length === 0) return viewDataMap;

  const out: Record<string, ViewData> = { ...viewDataMap };
  let any = false;

  for (const [supplierKey, vd] of Object.entries(viewDataMap)) {
    if (vd.type !== 'post') continue;
    let touched = false;
    const purchaseOrders = vd.purchaseOrders.map((po) => {
      const nextStatus = statusByPoId[po.id];
      if (nextStatus === undefined) return po;

      touched = true;
      const emailDeliveryOutstanding = computeEmailDeliveryOutstanding({
        supplierOrderChannelType: po.supplierOrderChannelType,
        emailSentAt: po.panelMeta?.emailSentAt
          ? new Date(po.panelMeta.emailSentAt)
          : null,
        archivedAt: po.archivedAt ? new Date(po.archivedAt) : null,
        legacyExternalId: po.legacyExternalId,
        emailDeliveryWaivedAt: po.panelMeta?.emailDeliveryWaivedAt
          ? new Date(po.panelMeta.emailDeliveryWaivedAt)
          : null,
        purchaseOrderStatus: nextStatus,
      });

      const next: OfficePurchaseOrderBlock = {
        ...po,
        status: nextStatus,
        emailDeliveryOutstanding,
        panelMeta: po.panelMeta
          ? { ...po.panelMeta, status: nextStatus }
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

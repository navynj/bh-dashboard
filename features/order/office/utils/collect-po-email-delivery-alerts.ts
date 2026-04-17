import type {
  SupplierKey,
  SupplierEntry,
  ViewData,
  OfficePurchaseOrderBlock,
  StatusTab,
} from '../types';
import {
  isOfficePoDeliveryDone,
  supplierRowHasOpenDeliveryPo,
  supplierRowHasFulfilledListPo,
} from './po-fulfillment-for-tab';

/**
 * Status tab where this supplier row appears so we can deep-link from alerts.
 * Prefers PO Created / Fulfilled over Inbox so the PO view is selected (Inbox effect defaults to drafts).
 */
export function pickStatusTabForEmailAlertPo(args: {
  entry: SupplierEntry;
  vd: ViewData | undefined;
  po: OfficePurchaseOrderBlock;
}): StatusTab {
  const { entry, vd, po } = args;
  if (entry.isArchived) return 'po_created';

  const openDelivery = !isOfficePoDeliveryDone(po);
  const fulfilledList =
    po.id !== 'new' &&
    isOfficePoDeliveryDone(po) &&
    po.status !== 'completed';

  if (openDelivery && entry.poCreated && supplierRowHasOpenDeliveryPo(vd)) {
    return 'po_created';
  }
  if (
    fulfilledList &&
    entry.poCreated &&
    supplierRowHasFulfilledListPo(vd) &&
    !entry.allCompleted
  ) {
    return 'fulfilled';
  }
  if (entry.withoutPoDraftCount > 0) return 'without_po';
  if (entry.poCreated && supplierRowHasOpenDeliveryPo(vd)) return 'po_created';
  if (entry.poCreated && supplierRowHasFulfilledListPo(vd)) return 'fulfilled';
  return 'po_created';
}

export type PoEmailDeliveryAlertItem = {
  purchaseOrderId: string;
  poNumber: string;
  supplierKey: SupplierKey;
  supplierCompany: string;
  customerLabel: string;
  hasEmailContacts: boolean;
};

function customerLabelForSupplierKey(
  supplierKey: SupplierKey,
  customerGroups: { id: string; name: string }[],
): string {
  const custId = supplierKey.split('::')[0] ?? '';
  const g = customerGroups.find((c) => c.id === custId);
  return g?.name?.trim() || 'Customer';
}

export function collectPoEmailDeliveryAlerts(args: {
  viewDataMap: Record<SupplierKey, ViewData>;
  states: Record<SupplierKey, SupplierEntry>;
  customerGroups: { id: string; name: string }[];
}): PoEmailDeliveryAlertItem[] {
  const { viewDataMap, states, customerGroups } = args;
  const out: PoEmailDeliveryAlertItem[] = [];
  const seen = new Set<string>();

  for (const supplierKey of Object.keys(viewDataMap)) {
    const vd = viewDataMap[supplierKey];
    if (vd?.type !== 'post') continue;
    const entry = states[supplierKey];
    if (!entry) continue;

    for (const po of vd.purchaseOrders) {
      if (po.id === 'new' || !po.emailDeliveryOutstanding) continue;
      if (seen.has(po.id)) continue;
      seen.add(po.id);
      out.push({
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierKey,
        supplierCompany: entry.supplierCompany,
        customerLabel: customerLabelForSupplierKey(
          supplierKey,
          customerGroups,
        ),
        hasEmailContacts: entry.hasEmail,
      });
    }
  }

  return out.sort((a, b) => {
    const c = a.customerLabel.localeCompare(b.customerLabel);
    if (c !== 0) return c;
    const s = a.supplierCompany.localeCompare(b.supplierCompany);
    if (s !== 0) return s;
    return a.poNumber.localeCompare(b.poNumber, undefined, { numeric: true });
  });
}

export function supplierHasPoEmailDeliveryOutstanding(
  supplierKey: SupplierKey,
  viewDataMap: Record<SupplierKey, ViewData>,
): boolean {
  const vd = viewDataMap[supplierKey];
  if (vd?.type !== 'post') return false;
  return vd.purchaseOrders.some(
    (p) => p.id !== 'new' && p.emailDeliveryOutstanding,
  );
}

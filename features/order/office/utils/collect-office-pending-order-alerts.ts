import type { SupplierKey, SupplierEntry, ViewData } from '../types';

export type OfficePendingOrderAlertItem = {
  purchaseOrderId: string;
  poNumber: string;
  supplierKey: SupplierKey;
  supplierCompany: string;
  customerLabel: string;
};

function customerLabelForSupplierKey(
  supplierKey: SupplierKey,
  customerGroups: { id: string; name: string }[],
): string {
  const custId = supplierKey.split('::')[0] ?? '';
  const g = customerGroups.find((c) => c.id === custId);
  return g?.name?.trim() || 'Customer';
}

/**
 * Hub POs with `status === 'pending'` (same rows as the PO Pending status tab).
 * Used by the amber office strip — not Shopify `office_pending_at` on drafts.
 */
export function collectOfficePendingOrderAlerts(args: {
  viewDataMap: Record<SupplierKey, ViewData>;
  states: Record<SupplierKey, SupplierEntry>;
  customerGroups: { id: string; name: string }[];
}): OfficePendingOrderAlertItem[] {
  const { viewDataMap, states, customerGroups } = args;
  const out: OfficePendingOrderAlertItem[] = [];
  const seen = new Set<string>();

  for (const supplierKey of Object.keys(viewDataMap)) {
    const key = supplierKey as SupplierKey;
    const entry = states[key];
    if (!entry || entry.isArchived) continue;

    const vd = viewDataMap[key];
    if (!vd || vd.type !== 'post') continue;

    for (const po of vd.purchaseOrders) {
      if (po.id === 'new' || po.archivedAt) continue;
      if (po.status !== 'pending') continue;
      if (seen.has(po.id)) continue;
      seen.add(po.id);
      out.push({
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierKey: key,
        supplierCompany: entry.supplierCompany,
        customerLabel: customerLabelForSupplierKey(key, customerGroups),
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

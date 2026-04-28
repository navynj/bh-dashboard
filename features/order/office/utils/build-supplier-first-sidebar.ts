import type {
  SidebarCustomerGroup,
  SidebarSupplierGroup,
  SidebarSupplierRow,
  SupplierEntry,
  SupplierKey,
} from '../types';

function latestOrderDateForCustomerRow(
  groups: SidebarCustomerGroup[],
  entryKey: SupplierKey,
): string | null {
  for (const g of groups) {
    if (!g.suppliers.some((s) => s.key === entryKey)) continue;
    return g.latestOrderDate ?? null;
  }
  return null;
}

/**
 * Regroup tab-filtered inbox rows by **supplier**, then customer (same `SupplierKey` / view rows).
 */
export function buildSupplierFirstGroups(
  groups: SidebarCustomerGroup[],
  states: Record<SupplierKey, SupplierEntry>,
): SidebarSupplierGroup[] {
  const bySup = new Map<
    string,
    { rows: SidebarSupplierRow[]; hasWithout: boolean }
  >();

  for (const g of groups) {
    for (const s of g.suppliers) {
      const parts = s.key.split('::');
      const supId = parts.length >= 2 ? parts[1]! : s.key;
      if (!bySup.has(supId)) {
        bySup.set(supId, { rows: [], hasWithout: false });
      }
      const cell = bySup.get(supId)!;
      if ((s.withoutPoCount ?? 0) > 0) cell.hasWithout = true;
      cell.rows.push({
        key: s.key,
        name: g.name,
        poPills: s.poPills,
        withoutPoCount: s.withoutPoCount,
      });
    }
  }

  const out: SidebarSupplierGroup[] = [];
  for (const [supId, { rows, hasWithout }] of bySup) {
    rows.sort((a, b) => {
      const da = latestOrderDateForCustomerRow(groups, a.key) ?? '';
      const db = latestOrderDateForCustomerRow(groups, b.key) ?? '';
      if (da > db) return -1;
      if (da < db) return 1;
      return a.name.localeCompare(b.name);
    });

    const supplierName = (() => {
      for (const r of rows) {
        const e = states[r.key];
        if (e?.supplierCompany) return e.supplierCompany;
      }
      return '—';
    })();

    const officePoSupplierCode = (() => {
      for (const r of rows) {
        const c = states[r.key]?.officePoSupplierCode?.trim();
        if (c) return c;
      }
      return null;
    })();

    out.push({
      id: supId,
      name: supplierName,
      officePoSupplierCode,
      customers: rows,
      hasWithoutPo: hasWithout,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

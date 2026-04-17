import { formatOfficeDateHeader } from './format-date-label';
import type {
  OfficePurchaseOrderBlock,
  SidebarCustomerGroup,
  SidebarSupplierRow,
  ViewData,
} from '../types';
import type { SupplierKey } from '../types';

export type ScopedSupplierRow = SidebarSupplierRow & {
  /** PO ids in this expected-date bucket (right column). */
  visiblePoIds: string[];
};

export type ScopedCustomerGroup = Omit<SidebarCustomerGroup, 'suppliers'> & {
  suppliers: ScopedSupplierRow[];
};

export type ExpectedDateSidebarBucket = {
  expectedDateKey: string;
  /** Left column (e.g. “Delivery expected at” / “Ordered at”). */
  headerLeft: string;
  /** Right column — formatted date or em dash when none. */
  headerRight: string;
  /** Single-line concatenation of left + right (e.g. accessibility). */
  headerLabel: string;
  customerGroups: ScopedCustomerGroup[];
};

/** Normalize PO `panelMeta.expectedDate` to a bucket key (YYYY-MM-DD or `__none__`). */
export function expectedDateKeyFromPo(
  panelExpected: string | null | undefined,
): string {
  if (!panelExpected || panelExpected === '') return '__none__';
  return panelExpected.length >= 10 ? panelExpected.slice(0, 10) : panelExpected;
}

export type BuildExpectedDateBucketsOptions = {
  /** When set, only POs whose delivery-expected date matches this bucket key are included. */
  onlyExpectedDateKey?: string | null;
  /** Archived: left label “Ordered at”. Default: “Delivery expected at”. */
  bucketStyle?: 'delivery_expected' | 'ordered';
  /**
   * When set (PO Created / Fulfilled tabs), only matching POs appear in buckets —
   * mixed supplier rows can list open vs fulfilled POs separately.
   */
  includePo?: (po: OfficePurchaseOrderBlock) => boolean;
};

/**
 * Re-group filtered customer/supplier rows by PO expected date (desc), then customer.
 * Used for PO Created, Fulfilled, Completed, Archived — not Inbox.
 */
export function buildExpectedDateBuckets(
  filteredGroups: SidebarCustomerGroup[],
  viewDataMap: Record<SupplierKey, ViewData>,
  options?: BuildExpectedDateBucketsOptions,
): ExpectedDateSidebarBucket[] {
  type Cell = {
    groupMeta: SidebarCustomerGroup;
    bySup: Map<SupplierKey, Set<string>>;
  };
  const buckets = new Map<string, Map<string, Cell>>();

  for (const g of filteredGroups) {
    for (const sup of g.suppliers) {
      const vd = viewDataMap[sup.key];
      if (!vd || vd.type !== 'post') continue;
      for (const po of vd.purchaseOrders) {
        if (po.id === 'new') continue;
        if (options?.includePo && !options.includePo(po)) continue;
        const ed = expectedDateKeyFromPo(po.panelMeta?.expectedDate ?? null);
        if (
          options?.onlyExpectedDateKey &&
          ed !== options.onlyExpectedDateKey
        ) {
          continue;
        }
        if (!buckets.has(ed)) buckets.set(ed, new Map());
        const byCust = buckets.get(ed)!;
        const custKey = g.id;
        if (!byCust.has(custKey)) {
          byCust.set(custKey, { groupMeta: g, bySup: new Map() });
        }
        const cell = byCust.get(custKey)!;
        if (!cell.bySup.has(sup.key)) cell.bySup.set(sup.key, new Set());
        cell.bySup.get(sup.key)!.add(po.id);
      }
    }
  }

  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    return b.localeCompare(a);
  });

  return keys.map((k) => {
    const byCust = buckets.get(k)!;
    const customerGroups: ScopedCustomerGroup[] = [];
    for (const { groupMeta, bySup } of byCust.values()) {
      const suppliers: ScopedSupplierRow[] = [];
      for (const [supKey, ids] of bySup) {
        const orig = groupMeta.suppliers.find((s) => s.key === supKey);
        if (!orig) continue;
        suppliers.push({
          ...orig,
          visiblePoIds: [...ids],
        });
      }
      suppliers.sort((a, b) => a.name.localeCompare(b.name));
      customerGroups.push({
        ...groupMeta,
        suppliers,
      });
    }
    customerGroups.sort((a, b) => a.name.localeCompare(b.name));

    const headerRight =
      k === '__none__'
        ? '—'
        : (() => {
            try {
              return formatOfficeDateHeader(k);
            } catch {
              return k;
            }
          })();

    const headerLeft =
      options?.bucketStyle === 'ordered' ? 'Ordered at' : 'Delivery expected at';

    const headerLabel = `${headerLeft} ${headerRight}`;

    return {
      expectedDateKey: k,
      headerLeft,
      headerRight,
      headerLabel,
      customerGroups,
    };
  });
}

/** Flat list of POs for one customer within an expected-date bucket (supplier ≈ one PO each). */
export type PoRefInBucket = {
  supplierKey: SupplierKey;
  poId: string;
};

export function sortPoRefsByPoNumber(
  refs: PoRefInBucket[],
  viewDataMap: Record<SupplierKey, ViewData>,
): PoRefInBucket[] {
  return [...refs].sort((a, b) => {
    const vdA = viewDataMap[a.supplierKey];
    const vdB = viewDataMap[b.supplierKey];
    const poA =
      vdA?.type === 'post'
        ? vdA.purchaseOrders.find((p) => p.id === a.poId)
        : undefined;
    const poB =
      vdB?.type === 'post'
        ? vdB.purchaseOrders.find((p) => p.id === b.poId)
        : undefined;
    return (poA?.poNumber ?? '').localeCompare(poB?.poNumber ?? '', undefined, {
      numeric: true,
    });
  });
}

export function collectPoRefsInCustomer(
  cg: ScopedCustomerGroup,
  viewDataMap: Record<SupplierKey, ViewData>,
): PoRefInBucket[] {
  const refs: PoRefInBucket[] = [];
  for (const sup of cg.suppliers) {
    for (const poId of sup.visiblePoIds) {
      refs.push({ supplierKey: sup.key, poId });
    }
  }
  return sortPoRefsByPoNumber(refs, viewDataMap);
}

/**
 * Default selection when opening PO tabs: same order as the sidebar — newest expected-date
 * bucket first, then customers A→Z within the bucket (`buildExpectedDateBuckets`), then the
 * first PO in that customer’s right column (`collectPoRefsInCustomer` = PO number order per
 * customer). Do **not** sort all POs in the bucket by number globally (that can skip the top
 * customer and pick another row’s lower PO number).
 */
export function pickFirstPoInNewestExpectedBucket(
  buckets: ExpectedDateSidebarBucket[],
  viewDataMap: Record<SupplierKey, ViewData>,
): { supplierKey: SupplierKey; poId: string } | null {
  for (const bucket of buckets) {
    for (const cg of bucket.customerGroups) {
      const refs = collectPoRefsInCustomer(cg, viewDataMap);
      if (refs.length === 0) continue;
      return { supplierKey: refs[0].supplierKey, poId: refs[0].poId };
    }
  }
  return null;
}

export function findBucketPageIndex(
  buckets: ExpectedDateSidebarBucket[],
  pageSize: number,
  activeKey: SupplierKey,
  selectedPoBlockId: string | null | undefined,
): number {
  if (!activeKey || !buckets.length) return 0;
  const idx = buckets.findIndex((bucket) =>
    bucket.customerGroups.some((cg) =>
      cg.suppliers.some(
        (s) =>
          s.key === activeKey &&
          selectedPoBlockId &&
          selectedPoBlockId !== '__drafts__' &&
          s.visiblePoIds.includes(selectedPoBlockId),
      ),
    ),
  );
  if (idx < 0) return 0;
  return Math.floor(idx / pageSize);
}

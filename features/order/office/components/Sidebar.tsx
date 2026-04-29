'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type {
  SupplierKey,
  SupplierEntry,
  SidebarCustomerGroup,
  SidebarSupplierGroup,
  StatusTab,
  ViewData,
  OfficePurchaseOrderBlock,
} from '../types';
import {
  collectPoRefsInCustomer,
  collectPoRefsForSupplierIdInBucket,
  supplierDatabaseIdFromEntryKey,
  type ExpectedDateSidebarBucket,
  type ScopedSupplierRow,
} from '../utils/sidebar-by-expected-date';
import { formatVancouverOrderedSidebar } from '../utils/vancouver-datetime';
import {
  supplierHasPoEmailDeliveryOutstanding,
  supplierHasPoEmailDeliveryOutstandingInVisiblePos,
} from '../utils/collect-po-email-delivery-alerts';

type Props = {
  customerGroups: SidebarCustomerGroup[];
  /**
   * When set (Inbox / `layout="customer"`), sidebar is grouped **supplier → customer**
   * instead of `customerGroups` order.
   */
  supplierFirstInboxGroups?: SidebarSupplierGroup[] | null;
  /** Inbox: customer-first. Other PO tabs: expected-date buckets (see below). */
  layout?: 'customer' | 'expected_date';
  /**
   * Within each expected-date bucket: left column lists customers (default) or suppliers,
   * then customer, then POs (PO Created / Fulfilled).
   */
  expectedDateBucketFirstColumn?: 'customer' | 'supplier';
  expectedDateBuckets?: ExpectedDateSidebarBucket[];
  expectedDatePage?: number;
  expectedDatePageCount?: number;
  onExpectedDatePageChange?: (page: number) => void;
  activeKey: SupplierKey;
  states: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  onSelect: (key: SupplierKey) => void;
  onSelectPo: (key: SupplierKey, poBlockId: string) => void;
  selectedPoBlockId?: string | null;
  /** Bucket key for the selected PO’s delivery expected date (expected-date layout only). */
  selectionExpectedDateKey?: string | null;
  activeStatusTab?: StatusTab;
  /** When true, archived rows are shown — hide Without-PO dots like other post‑draft tabs. */
  showArchived?: boolean;
};

function expandKey(bucketKey: string | undefined, groupId: string) {
  return bucketKey ? `${bucketKey}::${groupId}` : groupId;
}

function PoSidebarEmailStatusLine({
  po,
  emphasizeOutstanding,
}: {
  po: OfficePurchaseOrderBlock;
  /** Red “not sent” only on PO Created tab; elsewhere muted. */
  emphasizeOutstanding: boolean;
}) {
  if (po.supplierOrderChannelType !== 'email') return null;
  if (po.legacyExternalId != null) return null;

  const deliveries = po.panelMeta?.emailDeliveries ?? [];
  const sentIso = po.panelMeta?.emailSentAt;
  const waivedIso = po.panelMeta?.emailDeliveryWaivedAt;

  // Nothing sent yet
  if (deliveries.length === 0 && !sentIso) {
    if (waivedIso) {
      return (
        <div className="text-[9px] leading-tight mt-px text-muted-foreground font-medium">
          Email: Not sending (waived)
        </div>
      );
    }
    return (
      <div
        className={
          emphasizeOutstanding
            ? 'text-[9px] leading-tight mt-px text-destructive font-semibold'
            : 'text-[9px] leading-tight mt-px text-muted-foreground font-medium'
        }
      >
        Email: Not sent
      </div>
    );
  }

  const total = deliveries.length > 0 ? deliveries.length : 1;
  const replyReceivedAt = po.panelMeta?.emailReplyReceivedAt;

  return (
    <div className="flex items-center gap-1.5 mt-px">
      <div className="flex items-center gap-0.5">
        {deliveries.length > 0
          ? deliveries.map((_, i) => (
              <span key={i} className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
            ))
          : <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />}
      </div>
      <span className="text-[8px] leading-none font-medium text-emerald-700">
        Sent {total > 1 ? `×${total}` : ''}
      </span>
      {replyReceivedAt ? (
        <span className="text-[8px] leading-none font-medium text-blue-600">· Reply ✓</span>
      ) : null}
    </div>
  );
}


/** Email plus secondary label (company under override headline, or Shopify name under company headline). */
function sidebarCustomerSubline(group: SidebarCustomerGroup): string {
  const parts: string[] = [];
  const email = group.email?.trim() || '';
  if (email) parts.push(email);

  const o = group.displayNameOverride?.trim() || null;
  const c = group.company?.trim() || null;
  const shopifyPersonal = group.customerDisplayName?.trim() || null;
  const headline = group.name.trim();

  if (c && headline === c && shopifyPersonal) {
    parts.push(shopifyPersonal);
  } else if (o && headline === o && c) {
    parts.push(c);
  }

  return parts.filter((p) => p !== headline).join(' · ');
}

function sidebarSupplierChannelSubline(
  group: SidebarSupplierGroup,
  states: Record<SupplierKey, SupplierEntry>,
): string {
  const k = group.customers[0]?.key;
  if (!k) return '';
  return states[k]?.supplierOrderChannelSummary?.trim() ?? '';
}

export function Sidebar({
  customerGroups,
  supplierFirstInboxGroups = null,
  layout = 'customer',
  expectedDateBucketFirstColumn = 'customer',
  expectedDateBuckets,
  expectedDatePage = 0,
  expectedDatePageCount = 1,
  onExpectedDatePageChange,
  activeKey,
  states,
  viewDataMap,
  onSelect,
  onSelectPo,
  selectedPoBlockId,
  selectionExpectedDateKey,
  activeStatusTab,
  showArchived = false,
}: Props) {
  /** PO email “nag” (red) only on PO Created — not on Inbox / other status tabs. */
  const emphasizePoEmailNag = activeStatusTab === 'po_created';

  const draftsOnly =
    activeStatusTab === 'without_po' || activeStatusTab === 'inbox';
  const hideIndicators =
    draftsOnly ||
    activeStatusTab === 'po_created' ||
    activeStatusTab === 'fulfilled' ||
    activeStatusTab === 'completed' ||
    showArchived;

  /** Parent passes `null` for customer-first; non-null (possibly empty) for supplier-first inbox. */
  const inboxSupplierFirst =
    layout === 'customer' && supplierFirstInboxGroups != null;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const id = customerGroups[0]?.id;
    return id ? new Set([id]) : new Set();
  });

  useEffect(() => {
    if (layout !== 'customer') return;
    if (inboxSupplierFirst) {
      const head = supplierFirstInboxGroups?.[0];
      setExpanded(head ? new Set([`supfg::${head.id}`]) : new Set());
      return;
    }
    const id = customerGroups[0]?.id;
    setExpanded(id ? new Set([id]) : new Set());
    // Intentionally only when switching customer ↔ supplier grouping (not on filter churn).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [inboxSupplierFirst, layout]);

  function toggleArrow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickFirstPoForSupplier(
    sup: SidebarCustomerGroup['suppliers'][0],
    vd: ViewData,
  ) {
    if (vd.type !== 'post' || vd.purchaseOrders.length === 0) return;
    const scope = (sup as ScopedSupplierRow).visiblePoIds;
    const list =
      scope && scope.length > 0
        ? vd.purchaseOrders.filter((p) => scope.includes(p.id))
        : vd.purchaseOrders;
    const first = list[0];
    if (first) onSelectPo(sup.key, first.id);
  }

  function handleNameClick(
    group: SidebarCustomerGroup,
    bucketKey: string | undefined,
  ) {
    const eid = expandKey(bucketKey, group.id);
    setExpanded((prev) => {
      if (prev.has(eid)) {
        const next = new Set(prev);
        next.delete(eid);
        return next;
      }
      return new Set([eid]);
    });

    if (expanded.has(eid)) return;

    const firstSup = group.suppliers[0];
    if (!firstSup) return;

    const vd = viewDataMap[firstSup.key];
    if (vd) {
      const draftsForNav =
        vd.type === 'pre'
          ? vd.shopifyOrderDrafts
          : (vd.shopifyOrderDrafts ?? []);
      const draftCount = draftsForNav.filter((d) => !d.archivedAt).length;

      if (draftCount > 0) {
        onSelectPo(firstSup.key, '__drafts__');
        return;
      }

      if (vd.type === 'post' && vd.purchaseOrders.length > 0) {
        pickFirstPoForSupplier(firstSup, vd);
        return;
      }
    }

    onSelect(firstSup.key);
  }

  function handleSupplierGroupNameClick(group: SidebarSupplierGroup) {
    const eid = `supfg::${group.id}`;
    setExpanded((prev) => {
      if (prev.has(eid)) {
        const next = new Set(prev);
        next.delete(eid);
        return next;
      }
      return new Set([eid]);
    });

    if (expanded.has(eid)) return;

    const firstRow = group.customers[0];
    if (!firstRow) return;

    const vd = viewDataMap[firstRow.key];
    if (vd) {
      const draftsForNav =
        vd.type === 'pre'
          ? vd.shopifyOrderDrafts
          : (vd.shopifyOrderDrafts ?? []);
      const draftCount = draftsForNav.filter((d) => !d.archivedAt).length;

      if (draftCount > 0) {
        onSelectPo(firstRow.key, '__drafts__');
        return;
      }

      if (vd.type === 'post' && vd.purchaseOrders.length > 0) {
        pickFirstPoForSupplier(firstRow, vd);
        return;
      }
    }

    onSelect(firstRow.key);
  }

  function renderCustomerGroup(
    group: SidebarCustomerGroup,
    bucketKey: string | undefined,
  ) {
    const eid = expandKey(bucketKey, group.id);
    const isOpen = expanded.has(eid);
    const hasPoEmailAlert = group.suppliers.some((s) =>
      supplierHasPoEmailDeliveryOutstanding(s.key, viewDataMap),
    );
    const nag = emphasizePoEmailNag && hasPoEmailAlert;
    return (
      <div key={eid} className="border-b">
        <div className="flex items-start justify-between px-2 py-2 gap-2 hover:bg-muted/50">
          <div
            className="gap-[5px] min-w-0 flex-1 cursor-pointer"
            onClick={() => handleNameClick(group, bucketKey)}
          >
            <div className="flex items-center gap-[5px]">
              {!hideIndicators && (
                <span
                  className={cn(
                    'w-[5px] h-[5px] rounded-full bg-[#EF9F27] flex-shrink-0',
                    group.hasWithoutPo ? 'block' : 'invisible',
                  )}
                />
              )}
              <div
                className={cn(
                  'flex min-w-0 items-baseline gap-1 text-[13px] font-medium',
                  nag && 'text-destructive',
                )}
              >
                {group.officePoAccountCode?.trim() ? (
                  <>
                    <span className="shrink-0 font-mono text-[12px]">
                      {group.officePoAccountCode.trim()}
                    </span>
                    <span className="shrink-0 text-muted-foreground font-normal">
                      ·
                    </span>
                  </>
                ) : null}
                <span className="min-w-0 truncate">{group.name}</span>
              </div>
            </div>
            {(() => {
              const sub = sidebarCustomerSubline(group);
              return sub ? (
                <div
                  className={cn(
                    'text-[10px] mt-0.5 truncate',
                    nag ? 'text-destructive/90' : 'text-muted-foreground',
                    !hideIndicators && 'pl-[10px]',
                  )}
                >
                  {sub}
                </div>
              ) : null;
            })()}
          </div>
          <span
            className={cn(
              'text-[9px] text-muted-foreground transition-transform duration-150 flex-shrink-0 mt-[2px] cursor-pointer px-1',
              isOpen && 'rotate-90',
            )}
            onClick={() => toggleArrow(eid)}
          >
            ▶
          </span>
        </div>

        {isOpen && (
          <TwoColumnView
            suppliers={group.suppliers}
            activeKey={activeKey}
            states={states}
            viewDataMap={viewDataMap}
            selectedPoBlockId={selectedPoBlockId}
            onSelect={onSelect}
            onSelectPo={onSelectPo}
            activeStatusTab={activeStatusTab}
          />
        )}
      </div>
    );
  }

  function renderSupplierGroup(group: SidebarSupplierGroup) {
    const eid = `supfg::${group.id}`;
    const isOpen = expanded.has(eid);
    const hasPoEmailAlert = group.customers.some((row) =>
      supplierHasPoEmailDeliveryOutstanding(row.key, viewDataMap),
    );
    const nag = emphasizePoEmailNag && hasPoEmailAlert;
    return (
      <div key={eid} className="border-b">
        <div className="flex items-start justify-between gap-2 px-2 py-2 hover:bg-muted/50">
          <div
            className="min-w-0 flex-1 cursor-pointer gap-[5px]"
            onClick={() => handleSupplierGroupNameClick(group)}
          >
            <div className="flex items-center gap-[5px]">
              {!hideIndicators && (
                <span
                  className={cn(
                    'h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#EF9F27]',
                    group.hasWithoutPo ? 'block' : 'invisible',
                  )}
                />
              )}
              <div
                className={cn(
                  'flex min-w-0 items-baseline gap-1 text-[13px] font-medium',
                  nag && 'text-destructive',
                )}
              >
                {group.officePoSupplierCode?.trim() ? (
                  <>
                    <span className="shrink-0 font-mono text-[12px]">
                      {group.officePoSupplierCode.trim()}
                    </span>
                    <span className="shrink-0 font-normal text-muted-foreground">
                      ·
                    </span>
                  </>
                ) : null}
                <span className="min-w-0 truncate">{group.name}</span>
              </div>
            </div>
            {(() => {
              const sub = sidebarSupplierChannelSubline(group, states);
              return sub ? (
                <div
                  className={cn(
                    'mt-0.5 truncate text-[10px]',
                    nag ? 'text-destructive/90' : 'text-muted-foreground',
                  )}
                >
                  {sub}
                </div>
              ) : null;
            })()}
          </div>
          <span
            className={cn(
              'mt-[2px] flex-shrink-0 cursor-pointer px-1 text-[9px] text-muted-foreground transition-transform duration-150',
              isOpen && 'rotate-90',
            )}
            onClick={() => toggleArrow(eid)}
          >
            ▶
          </span>
        </div>

        {isOpen && (
          <TwoColumnView
            suppliers={group.customers}
            activeKey={activeKey}
            states={states}
            viewDataMap={viewDataMap}
            selectedPoBlockId={selectedPoBlockId}
            onSelect={onSelect}
            onSelectPo={onSelectPo}
            activeStatusTab={activeStatusTab}
            leftColumnEmptyHint="Select customer"
          />
        )}
      </div>
    );
  }

  const showLegend = !hideIndicators && layout === 'customer';

  return (
    <div className="flex w-[248px] flex-shrink-0 flex-col overflow-y-auto border-r bg-background">
      {layout === 'expected_date' &&
        expectedDateBuckets &&
        expectedDateBuckets.length > 0 && (
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b bg-muted/30 flex-shrink-0 sticky top-0 z-[1]">
            <button
              type="button"
              className="text-[10px] px-1.5 py-0.5 rounded border border-border disabled:opacity-40"
              disabled={expectedDatePage <= 0}
              onClick={() => onExpectedDatePageChange?.(expectedDatePage - 1)}
            >
              Prev
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {expectedDatePage + 1} / {expectedDatePageCount}
            </span>
            <button
              type="button"
              className="text-[10px] px-1.5 py-0.5 rounded border border-border disabled:opacity-40"
              disabled={expectedDatePage >= expectedDatePageCount - 1}
              onClick={() => onExpectedDatePageChange?.(expectedDatePage + 1)}
            >
              Next
            </button>
          </div>
        )}

      {layout === 'expected_date' &&
        (!expectedDateBuckets || expectedDateBuckets.length === 0) && (
          <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">
            No matching orders
          </div>
        )}

      {layout === 'expected_date' &&
      expectedDateBuckets &&
      expectedDateBuckets.length > 0
        ? expectedDateBuckets.map((bucket) => (
            <div
              key={bucket.expectedDateKey}
              className="border-b border-border/60"
            >
              <div className="px-2 py-1.5 bg-muted/40 text-[11px] font-medium text-foreground/80 sticky top-0 z-[1] border-b border-border/40 flex items-center justify-between gap-2 min-w-0">
                <span className="truncate text-left">{bucket.headerLeft}</span>
                <span className="flex-shrink-0 tabular-nums text-foreground/90">
                  {bucket.headerRight}
                </span>
              </div>
              {expectedDateBucketFirstColumn === 'supplier' ? (
                <ExpectedDateSupplierFirstPanel
                  bucket={bucket}
                  activeKey={activeKey}
                  selectedPoBlockId={selectedPoBlockId}
                  selectionExpectedDateKey={selectionExpectedDateKey}
                  states={states}
                  viewDataMap={viewDataMap}
                  hideIndicators={hideIndicators}
                  emphasizePoEmailNag={emphasizePoEmailNag}
                  onSelectPo={onSelectPo}
                />
              ) : (
                <ExpectedDateBucketPanel
                  bucket={bucket}
                  activeKey={activeKey}
                  selectedPoBlockId={selectedPoBlockId}
                  selectionExpectedDateKey={selectionExpectedDateKey}
                  states={states}
                  viewDataMap={viewDataMap}
                  hideIndicators={hideIndicators}
                  emphasizePoEmailNag={emphasizePoEmailNag}
                  onSelectPo={onSelectPo}
                />
              )}
            </div>
          ))
        : layout === 'customer'
          ? supplierFirstInboxGroups
            ? supplierFirstInboxGroups.map(renderSupplierGroup)
            : customerGroups.map((group) =>
                renderCustomerGroup(group, undefined),
              )
          : null}

      {showLegend && (
        <div className="mt-auto px-3.5 py-2 border-t">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-[7px] h-[7px] rounded-full bg-[#EF9F27] inline-block flex-shrink-0" />
            Without PO
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expected date: one row per supplier (DB id) → POs (PO Created / Fulfilled) ─

function customerHeadlineForEntryKey(
  bucket: ExpectedDateSidebarBucket,
  supplierKey: SupplierKey,
): string {
  const cg = bucket.customerGroups.find((c) =>
    c.suppliers.some((s) => s.key === supplierKey),
  );
  return cg?.name ?? '—';
}

function supplierHasPoEmailAlertAnyKeyForDbId(
  bucket: ExpectedDateSidebarBucket,
  supplierDbId: string,
  viewDataMap: Record<SupplierKey, ViewData>,
): boolean {
  for (const cg of bucket.customerGroups) {
    for (const s of cg.suppliers) {
      if (supplierDatabaseIdFromEntryKey(s.key) !== supplierDbId) continue;
      if (
        supplierHasPoEmailDeliveryOutstandingInVisiblePos(
          s.key,
          viewDataMap,
          s.visiblePoIds,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function labelForSupplierDbId(
  bucket: ExpectedDateSidebarBucket,
  states: Record<SupplierKey, SupplierEntry>,
  supplierDbId: string,
): { company: string; code: string | null } {
  for (const cg of bucket.customerGroups) {
    for (const s of cg.suppliers) {
      if (supplierDatabaseIdFromEntryKey(s.key) !== supplierDbId) continue;
      const e = states[s.key];
      return {
        company: e?.supplierCompany ?? '—',
        code: e?.officePoSupplierCode?.trim() || null,
      };
    }
  }
  return { company: '—', code: null };
}

function ExpectedDateSupplierFirstPanel({
  bucket,
  activeKey,
  selectedPoBlockId,
  selectionExpectedDateKey,
  states,
  viewDataMap,
  hideIndicators,
  emphasizePoEmailNag,
  onSelectPo,
}: {
  bucket: ExpectedDateSidebarBucket;
  activeKey: SupplierKey;
  selectedPoBlockId?: string | null;
  selectionExpectedDateKey?: string | null;
  states: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  hideIndicators: boolean;
  emphasizePoEmailNag: boolean;
  onSelectPo: (key: SupplierKey, poBlockId: string) => void;
}) {
  const supplierDbIdsInBucket = useMemo(() => {
    const ids = new Set<string>();
    for (const cg of bucket.customerGroups) {
      for (const s of cg.suppliers) {
        ids.add(supplierDatabaseIdFromEntryKey(s.key));
      }
    }
    return [...ids].sort((a, b) => {
      const la = labelForSupplierDbId(bucket, states, a).company;
      const lb = labelForSupplierDbId(bucket, states, b).company;
      return la.localeCompare(lb, undefined, { sensitivity: 'base' });
    });
  }, [bucket.customerGroups, states]);

  const [pickedSupId, setPickedSupId] = useState<string | null>(null);

  const selectionInThisBucket =
    selectionExpectedDateKey != null &&
    selectionExpectedDateKey === bucket.expectedDateKey;

  useEffect(() => {
    if (!selectionInThisBucket) {
      setPickedSupId(null);
    }
  }, [selectionInThisBucket]);

  useEffect(() => {
    if (!selectionInThisBucket) return;
    const idFromActive = supplierDatabaseIdFromEntryKey(activeKey);
    const hit = bucket.customerGroups
      .flatMap((cg) => cg.suppliers.map((s) => ({ cg, s })))
      .find(
        ({ s }) =>
          s.key === activeKey &&
          selectedPoBlockId &&
          selectedPoBlockId !== '__drafts__' &&
          s.visiblePoIds.includes(selectedPoBlockId),
      );
    if (hit && supplierDbIdsInBucket.includes(idFromActive)) {
      setPickedSupId(idFromActive);
    }
  }, [
    bucket.expectedDateKey,
    bucket.customerGroups,
    activeKey,
    selectedPoBlockId,
    supplierDbIdsInBucket,
    selectionExpectedDateKey,
    selectionInThisBucket,
  ]);

  const refs = useMemo(
    () =>
      pickedSupId && selectionInThisBucket
        ? collectPoRefsForSupplierIdInBucket(
            bucket,
            pickedSupId,
            viewDataMap,
          )
        : [],
    [
      bucket.customerGroups,
      bucket.expectedDateKey,
      pickedSupId,
      selectionInThisBucket,
      viewDataMap,
    ],
  );

  const distinctCustomerCount = useMemo(() => {
    const cust = new Set<string>();
    for (const r of refs) {
      const part = r.supplierKey.split('::')[0];
      if (part) cust.add(part);
    }
    return cust.size;
  }, [refs]);

  const showCustomerOnPo = distinctCustomerCount > 1;

  return (
    <div className="flex border-t border-border/40 pb-1">
      <div className="w-1/2 min-w-0 border-r border-border/40 overflow-y-auto">
        {supplierDbIdsInBucket.map((supId) => {
          const { company, code } = labelForSupplierDbId(
            bucket,
            states,
            supId,
          );
          const isOn = selectionInThisBucket && pickedSupId === supId;
          const nag =
            emphasizePoEmailNag &&
            supplierHasPoEmailAlertAnyKeyForDbId(
              bucket,
              supId,
              viewDataMap,
            );
          return (
            <div
              key={supId}
              role="button"
              tabIndex={0}
              onClick={() => {
                setPickedSupId(supId);
                const next = collectPoRefsForSupplierIdInBucket(
                  bucket,
                  supId,
                  viewDataMap,
                )[0];
                if (next) onSelectPo(next.supplierKey, next.poId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  (e.currentTarget as HTMLDivElement).click();
                }
              }}
              className={cn(
                'cursor-pointer border-b border-border/30 px-1.5 py-2 last:border-b-0',
                isOn ? 'bg-[#EBF4FD]' : 'hover:bg-muted/50',
              )}
            >
              <div className="flex items-center gap-1">
                {!hideIndicators && (
                  <span className="invisible h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#EF9F27]" />
                )}
                <div
                  className={cn(
                    'min-w-0 truncate text-[11px] font-medium',
                    nag && 'text-destructive',
                  )}
                >
                  {company}
                </div>
              </div>
              {code ? (
                <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                  {code}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="w-1/2 min-w-0 overflow-y-auto">
        {!selectionInThisBucket || !pickedSupId ? (
          <div className="flex min-h-[48px] items-center justify-center px-2">
            <span className="text-center text-[10px] italic text-muted-foreground/50">
              Supplier not selected
            </span>
          </div>
        ) : refs.length === 0 ? (
          <div className="flex min-h-[48px] items-center justify-center px-2">
            <span className="text-center text-[10px] italic text-muted-foreground/50">
              No POs
            </span>
          </div>
        ) : (
          refs.map((ref) => {
            const vd = viewDataMap[ref.supplierKey];
            const po =
              vd?.type === 'post'
                ? vd.purchaseOrders.find((p) => p.id === ref.poId)
                : undefined;
            if (!po) return null;
            const meta = po.panelMeta;
            const isOn =
              selectionInThisBucket &&
              activeKey === ref.supplierKey &&
              selectedPoBlockId !== '__drafts__' &&
              selectedPoBlockId === ref.poId;
            const custLabel = customerHeadlineForEntryKey(
              bucket,
              ref.supplierKey,
            );

            return (
              <button
                key={`${ref.supplierKey}-${ref.poId}`}
                type="button"
                onClick={() => onSelectPo(ref.supplierKey, ref.poId)}
                className={cn(
                  'flex w-full flex-col border-b border-border/30 px-2 py-[5px] text-left last:border-b-0',
                  isOn ? 'bg-[#EBF4FD]' : 'hover:bg-muted/40',
                )}
              >
                <div className="flex w-full min-w-0 flex-col gap-1">
                  <span
                    className={cn(
                      'truncate text-[11px]',
                      emphasizePoEmailNag && po.emailDeliveryOutstanding
                        ? 'text-destructive font-semibold'
                        : isOn
                          ? 'font-medium text-[#0C447C]'
                          : 'text-muted-foreground',
                    )}
                  >
                    #{po.poNumber}
                  </span>
                  {showCustomerOnPo && (
                    <Badge
                      variant="gray"
                      title={custLabel}
                      className={cn(
                        'h-auto max-w-full min-w-0 shrink self-start justify-start truncate rounded-md border-transparent px-1.5 py-px text-[10px] font-normal leading-tight',
                        isOn &&
                          'border border-[#B8D4EF] bg-white text-[#0C447C] hover:bg-white',
                      )}
                    >
                      {custLabel}
                    </Badge>
                  )}
                </div>
                {meta && (
                  <div className="mt-0.5 flex flex-col gap-px">
                    <DateLine label="Created" value={meta.dateCreated} />
                    <DateLine
                      label="Delivery expected"
                      value={meta.expectedDate}
                    />
                    <PoSidebarEmailStatusLine
                      po={po}
                      emphasizeOutstanding={emphasizePoEmailNag}
                    />
                    <FulfillLine
                      done={meta.fulfillDoneCount}
                      total={meta.fulfillTotalCount}
                    />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Expected date: customers (left) → POs for selection (right) ────────────

function ExpectedDateBucketPanel({
  bucket,
  activeKey,
  selectedPoBlockId,
  selectionExpectedDateKey,
  states,
  viewDataMap,
  hideIndicators,
  emphasizePoEmailNag,
  onSelectPo,
}: {
  bucket: ExpectedDateSidebarBucket;
  activeKey: SupplierKey;
  selectedPoBlockId?: string | null;
  selectionExpectedDateKey?: string | null;
  states: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  hideIndicators: boolean;
  emphasizePoEmailNag: boolean;
  onSelectPo: (key: SupplierKey, poBlockId: string) => void;
}) {
  const customers = bucket.customerGroups;
  const selectedCg =
    customers.find((cg) =>
      cg.suppliers.some(
        (s) =>
          s.key === activeKey &&
          selectedPoBlockId &&
          selectedPoBlockId !== '__drafts__' &&
          s.visiblePoIds.includes(selectedPoBlockId),
      ),
    ) ?? customers.find((cg) => cg.suppliers.some((s) => s.key === activeKey));

  return (
    <div className="flex border-t border-border/40 pb-1">
      <div className="w-1/2 border-r border-border/40 overflow-y-auto">
        {customers.map((cg) => {
          const isOn =
            cg.suppliers.some((s) => s.key === activeKey) &&
            selectionExpectedDateKey != null &&
            bucket.expectedDateKey === selectionExpectedDateKey;
          const refs = collectPoRefsInCustomer(cg, viewDataMap);
          const hasPoEmailAlert = cg.suppliers.some((s) =>
            supplierHasPoEmailDeliveryOutstandingInVisiblePos(
              s.key,
              viewDataMap,
              s.visiblePoIds,
            ),
          );
          const nag = emphasizePoEmailNag && hasPoEmailAlert;
          return (
            <div
              key={cg.id}
              onClick={() => {
                const first = refs[0];
                if (first) onSelectPo(first.supplierKey, first.poId);
              }}
              className={cn(
                'px-2 py-2 cursor-pointer border-b border-border/30 last:border-b-0',
                isOn ? 'bg-[#EBF4FD]' : 'hover:bg-muted/50',
              )}
            >
              <div className="flex items-center gap-[5px]">
                {!hideIndicators && (
                  <span
                    className={cn(
                      'w-[5px] h-[5px] rounded-full bg-[#EF9F27] flex-shrink-0',
                      cg.hasWithoutPo ? 'block' : 'invisible',
                    )}
                  />
                )}
                <div
                  className={cn(
                    'text-[12px] font-medium truncate',
                    nag && 'text-destructive',
                  )}
                >
                  {cg.name}
                </div>
              </div>
              {(() => {
                const sub = sidebarCustomerSubline(cg);
                return sub ? (
                  <div
                    className={cn(
                      'text-[10px] mt-0.5 truncate',
                      nag ? 'text-destructive/90' : 'text-muted-foreground',
                      !hideIndicators && 'pl-[10px]',
                    )}
                  >
                    {sub}
                  </div>
                ) : null;
              })()}
            </div>
          );
        })}
      </div>

      <div className="w-1/2 overflow-y-auto min-h-[48px]">
        {!selectedCg ? (
          <div className="flex items-center justify-center min-h-[48px] px-2">
            <span className="text-[10px] text-muted-foreground/50 italic text-center">
              Select a customer
            </span>
          </div>
        ) : (
          <>
            {collectPoRefsInCustomer(selectedCg, viewDataMap).map((ref) => {
            const vd = viewDataMap[ref.supplierKey];
            const po =
              vd?.type === 'post'
                ? vd.purchaseOrders.find((p) => p.id === ref.poId)
                : undefined;
            if (!po) return null;
            const entry = states[ref.supplierKey];
            const meta = po.panelMeta;
            const multiSup = selectedCg.suppliers.length > 1;
            const isOn =
              activeKey === ref.supplierKey &&
              selectedPoBlockId !== '__drafts__' &&
              selectedPoBlockId === ref.poId;

            return (
              <button
                key={`${ref.supplierKey}-${ref.poId}`}
                type="button"
                onClick={() => onSelectPo(ref.supplierKey, ref.poId)}
                className={cn(
                  'flex flex-col w-full px-2 py-[5px] text-left border-b border-border/30 last:border-b-0',
                  isOn ? 'bg-[#EBF4FD]' : 'hover:bg-muted/40',
                )}
              >
                <div className="flex flex-col gap-1 min-w-0 w-full">
                  <span
                    className={cn(
                      'text-[11px] truncate',
                      emphasizePoEmailNag && po.emailDeliveryOutstanding
                        ? 'text-destructive font-semibold'
                        : isOn
                          ? 'text-[#0C447C] font-medium'
                          : 'text-muted-foreground',
                    )}
                  >
                    #{po.poNumber}
                  </span>
                  {multiSup && (
                    <Badge
                      variant="gray"
                      title={entry?.supplierCompany ?? undefined}
                      className={cn(
                        'h-auto max-w-full min-w-0 shrink self-start justify-start rounded-md px-1.5 py-px text-[10px] font-normal leading-tight truncate border-transparent',
                        isOn &&
                          'border border-[#B8D4EF] bg-white text-[#0C447C] hover:bg-white',
                      )}
                    >
                      {entry?.supplierCompany ?? '—'}
                    </Badge>
                  )}
                </div>
                {meta && (
                  <div className="flex flex-col gap-px mt-0.5">
                    <DateLine label="Created" value={meta.dateCreated} />
                    <DateLine
                      label="Delivery expected"
                      value={meta.expectedDate}
                    />
                    <PoSidebarEmailStatusLine
                      po={po}
                      emphasizeOutstanding={emphasizePoEmailNag}
                    />
                    <FulfillLine
                      done={meta.fulfillDoneCount}
                      total={meta.fulfillTotalCount}
                    />
                  </div>
                )}
              </button>
            );
          })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Two-column layout: suppliers left, POs right (Inbox only) ───────────────

function TwoColumnView({
  suppliers,
  activeKey,
  states,
  viewDataMap,
  selectedPoBlockId,
  onSelect,
  onSelectPo,
  activeStatusTab,
  leftColumnEmptyHint = 'Select supplier',
}: {
  suppliers: SidebarCustomerGroup['suppliers'];
  activeKey: SupplierKey;
  states: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  selectedPoBlockId?: string | null;
  onSelect: (key: SupplierKey) => void;
  onSelectPo: (key: SupplierKey, poBlockId: string) => void;
  activeStatusTab?: StatusTab;
  /** Inbox supplier-first: left column is customers — adjust empty-state copy. */
  leftColumnEmptyHint?: string;
}) {
  const emphasizePoEmailNag = activeStatusTab === 'po_created';

  const isDraftsOnly =
    activeStatusTab === 'without_po' || activeStatusTab === 'inbox';
  const hideIndicators =
    isDraftsOnly ||
    activeStatusTab === 'po_created' ||
    activeStatusTab === 'fulfilled' ||
    activeStatusTab === 'completed';
  const groupContainsActive = suppliers.some((s) => s.key === activeKey);
  const activeVd = groupContainsActive ? viewDataMap[activeKey] : undefined;
  const activeSup = suppliers.find((s) => s.key === activeKey);

  const pos = isDraftsOnly
    ? []
    : activeVd?.type === 'post'
      ? activeVd.purchaseOrders
      : [];

  const hideDrafts =
    activeStatusTab === 'po_created' ||
    activeStatusTab === 'fulfilled' ||
    activeStatusTab === 'completed';
  const activeDraftCount = hideDrafts ? 0 : (activeSup?.withoutPoCount ?? 0);

  const activeDraftOrders: { orderNumber: string; orderedAt: string | null }[] =
    (() => {
      if (!groupContainsActive || !activeVd) return [];
      const drafts =
        activeVd.type === 'pre'
          ? activeVd.shopifyOrderDrafts
          : (activeVd.shopifyOrderDrafts ?? []);
      return drafts
        .filter((d) => !d.archivedAt)
        .map((d) => ({
          orderNumber: d.orderNumber,
          orderedAt: d.orderedAt,
        }));
    })();

  return (
    <div className="flex border-t border-border/40">
      <div className="w-1/2 border-r border-border/40 overflow-y-auto">
        {suppliers.map((sup) => {
          const entry = states[sup.key];
          if (!entry) return null;
          const isOn = activeKey === sup.key;
          const isPrePo = !entry.poCreated;
          const hasDrafts = (sup.withoutPoCount ?? 0) > 0;
          const hasPoEmailAlert = supplierHasPoEmailDeliveryOutstanding(
            sup.key,
            viewDataMap,
          );
          const nag = emphasizePoEmailNag && hasPoEmailAlert;

          return (
            <div
              key={sup.key}
              onClick={() => onSelect(sup.key)}
              className={cn(
                'flex items-center gap-[5px] px-2 py-[5px] cursor-pointer',
                isOn ? 'bg-[#EBF4FD]' : 'hover:bg-muted/50',
              )}
            >
              {!hideIndicators && (isPrePo || hasDrafts) ? (
                <span className="w-[5px] h-[5px] rounded-full bg-[#EF9F27] flex-shrink-0" />
              ) : !hideIndicators ? (
                <span className="w-[5px] h-[5px] flex-shrink-0" />
              ) : null}
              <span
                className={cn(
                  'text-[11px] truncate',
                  nag && 'text-destructive font-semibold',
                  !nag &&
                    (isOn
                      ? 'text-[#0C447C] font-medium'
                      : 'text-muted-foreground'),
                )}
              >
                {sup.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="w-1/2 overflow-y-auto">
        {!groupContainsActive ? (
          <div className="flex items-center justify-center h-full min-h-[40px] px-2">
            <span className="text-[10px] text-muted-foreground/40 italic">
              {leftColumnEmptyHint}
            </span>
          </div>
        ) : (
          <>
            {activeDraftCount > 0 && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectPo(activeKey, '__drafts__')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    onSelectPo(activeKey, '__drafts__');
                }}
                className={cn(
                  'w-full px-1.5 py-1 cursor-pointer text-left',
                  pos.length > 0 && 'border-b border-border/30',
                  selectedPoBlockId === '__drafts__'
                    ? 'bg-[#EBF4FD]'
                    : 'hover:bg-muted/40',
                )}
              >
                {isDraftsOnly ? (
                  <div className="flex flex-col gap-[2px]">
                    {activeDraftOrders.map((d) => (
                      <div
                        key={d.orderNumber}
                        className={cn(
                          'flex items-center justify-between gap-1 rounded-[4px] px-1.5 py-[1px] border',
                          selectedPoBlockId === '__drafts__'
                            ? 'border-[#0C447C]/25 bg-[#0C447C]/8 text-[#0C447C]'
                            : 'border-border bg-muted/40 text-muted-foreground',
                        )}
                      >
                        <span className="text-[10px] tabular-nums font-medium">
                          {d.orderNumber}
                        </span>
                        {d.orderedAt && (
                          <span className="text-[9px] opacity-60 tabular-nums flex-shrink-0">
                            {formatVancouverOrderedSidebar(d.orderedAt)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="w-[5px] h-[5px] rounded-full bg-[#EF9F27] flex-shrink-0" />
                    <span
                      className={cn(
                        'text-[10px]',
                        selectedPoBlockId === '__drafts__'
                          ? 'text-[#8B5A00] font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      {activeDraftCount} without PO
                    </span>
                  </div>
                )}
              </div>
            )}
            {pos.length === 0 && activeDraftCount === 0 && (
              <div className="flex items-center justify-center h-full min-h-[40px] px-2">
                <span className="text-[10px] text-muted-foreground/50 italic">
                  No PO created
                </span>
              </div>
            )}
            {pos.map((po) => {
              const isOn =
                selectedPoBlockId !== '__drafts__' &&
                po.id === (selectedPoBlockId ?? pos[0]?.id);
              const meta = po.panelMeta;

              return (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => onSelectPo(activeKey, po.id)}
                  className={cn(
                    'flex flex-col w-full px-2 py-[5px] text-left border-b border-border/30 last:border-b-0',
                    isOn ? 'bg-[#EBF4FD]' : 'hover:bg-muted/40',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] truncate',
                      emphasizePoEmailNag && po.emailDeliveryOutstanding
                        ? 'text-destructive font-semibold'
                        : isOn
                          ? 'text-[#0C447C] font-medium'
                          : 'text-muted-foreground',
                    )}
                  >
                    #{po.poNumber}
                  </span>

                  {meta && (
                    <div className="flex flex-col gap-px mt-0.5">
                      <DateLine label="Created" value={meta.dateCreated} />
                      <DateLine
                        label="Delivery expected"
                        value={meta.expectedDate}
                      />
                      <PoSidebarEmailStatusLine
                        po={po}
                        emphasizeOutstanding={emphasizePoEmailNag}
                      />
                      <FulfillLine
                        done={meta.fulfillDoneCount}
                        total={meta.fulfillTotalCount}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function DateLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-[9px] text-muted-foreground/70 leading-tight">
      <span className="text-muted-foreground/50">{label}</span> {value ?? '—'}
    </div>
  );
}

function FulfillLine({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const allDone = done >= total;
  return (
    <div
      className={cn(
        'text-[9px] leading-tight',
        allDone ? 'text-[#27500A]' : 'text-[#BA7517]',
      )}
    >
      {done}/{total} items received
    </div>
  );
}

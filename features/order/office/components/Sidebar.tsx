'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type {
  SupplierKey,
  SupplierEntry,
  SidebarCustomerGroup,
  StatusTab,
  ViewData,
  OfficePurchaseOrderBlock,
} from '../types';
import {
  collectPoRefsInCustomer,
  type ExpectedDateSidebarBucket,
  type ScopedSupplierRow,
} from '../utils/sidebar-by-expected-date';
import { formatVancouverOrderedSidebar } from '../utils/vancouver-datetime';
import { supplierHasPoEmailDeliveryOutstanding } from '../utils/collect-po-email-delivery-alerts';

type Props = {
  customerGroups: SidebarCustomerGroup[];
  /** Inbox: customer-first. Other PO tabs: expected-date buckets (see below). */
  layout?: 'customer' | 'expected_date';
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

function PoSidebarEmailStatusLine({ po }: { po: OfficePurchaseOrderBlock }) {
  if (po.supplierOrderChannelType !== 'email') return null;
  if (po.legacyExternalId != null) return null;

  const deliveries = po.panelMeta?.emailDeliveries ?? [];
  const sentIso = po.panelMeta?.emailSentAt;

  // Nothing sent yet
  if (deliveries.length === 0 && !sentIso) {
    return (
      <div className="text-[9px] leading-tight mt-px text-destructive font-semibold">
        Email: Not sent
      </div>
    );
  }

  const total = deliveries.length > 0 ? deliveries.length : 1;

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

export function Sidebar({
  customerGroups,
  layout = 'customer',
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
  const draftsOnly =
    activeStatusTab === 'without_po' || activeStatusTab === 'inbox';
  const hideIndicators =
    draftsOnly ||
    activeStatusTab === 'po_created' ||
    activeStatusTab === 'fulfilled' ||
    activeStatusTab === 'completed' ||
    showArchived;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const id = customerGroups[0]?.id;
    return id ? new Set([id]) : new Set();
  });

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
      const draftCount =
        vd.type === 'pre'
          ? vd.shopifyOrderDrafts.length
          : (vd.shopifyOrderDrafts?.length ?? 0);

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

  function renderCustomerGroup(
    group: SidebarCustomerGroup,
    bucketKey: string | undefined,
  ) {
    const eid = expandKey(bucketKey, group.id);
    const isOpen = expanded.has(eid);
    const hasPoEmailAlert = group.suppliers.some((s) =>
      supplierHasPoEmailDeliveryOutstanding(s.key, viewDataMap),
    );
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
                  'text-[13px] font-medium truncate',
                  hasPoEmailAlert && 'text-destructive',
                )}
              >
                {group.name}
              </div>
            </div>
            {(() => {
              const sub = sidebarCustomerSubline(group);
              return sub ? (
                <div
                  className={cn(
                    'text-[10px] mt-0.5 truncate',
                    hasPoEmailAlert
                      ? 'text-destructive/90'
                      : 'text-muted-foreground',
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

  const showLegend = !hideIndicators && layout === 'customer';

  return (
    <div className="w-[248px] flex-shrink-0 border-r bg-background flex flex-col overflow-y-auto">
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
              <ExpectedDateBucketPanel
                bucket={bucket}
                activeKey={activeKey}
                selectedPoBlockId={selectedPoBlockId}
                selectionExpectedDateKey={selectionExpectedDateKey}
                states={states}
                viewDataMap={viewDataMap}
                hideIndicators={hideIndicators}
                onSelectPo={onSelectPo}
              />
            </div>
          ))
        : layout === 'customer'
          ? customerGroups.map((group) => renderCustomerGroup(group, undefined))
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

// ─── Expected date: customers (left) → POs for selection (right) ────────────

function ExpectedDateBucketPanel({
  bucket,
  activeKey,
  selectedPoBlockId,
  selectionExpectedDateKey,
  states,
  viewDataMap,
  hideIndicators,
  onSelectPo,
}: {
  bucket: ExpectedDateSidebarBucket;
  activeKey: SupplierKey;
  selectedPoBlockId?: string | null;
  selectionExpectedDateKey?: string | null;
  states: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  hideIndicators: boolean;
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
            supplierHasPoEmailDeliveryOutstanding(s.key, viewDataMap),
          );
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
                    hasPoEmailAlert && 'text-destructive',
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
                      hasPoEmailAlert
                        ? 'text-destructive/90'
                        : 'text-muted-foreground',
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
                      po.emailDeliveryOutstanding
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
                    <PoSidebarEmailStatusLine po={po} />
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
}: {
  suppliers: SidebarCustomerGroup['suppliers'];
  activeKey: SupplierKey;
  states: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  selectedPoBlockId?: string | null;
  onSelect: (key: SupplierKey) => void;
  onSelectPo: (key: SupplierKey, poBlockId: string) => void;
  activeStatusTab?: StatusTab;
}) {
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
      return drafts.map((d) => ({
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
                  hasPoEmailAlert && 'text-destructive font-semibold',
                  !hasPoEmailAlert &&
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
              Select supplier
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
                      po.emailDeliveryOutstanding
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
                      <PoSidebarEmailStatusLine po={po} />
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

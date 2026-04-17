'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { StatusTabBar } from '../components/StatusTabBar';
import { PeriodFilterBar } from '../components/PeriodFilterBar';
import { Sidebar } from '../components/Sidebar';
import { CenterBar } from '../components/CenterBar';
import { PrePoView } from '../components/PrePoView';
import { PostPoView } from '../components/PostPoView';
import { MetaPanel } from '../components/MetaPanel';
import { OrderProcessingBlock } from '../components/OrderProcessingBlock';
import { PoEmailDeliveryAlertsStrip } from '../components/PoEmailDeliveryAlertsStrip';
import {
  collectPoEmailDeliveryAlerts,
  pickStatusTabForEmailAlertPo,
  type PoEmailDeliveryAlertItem,
} from '../utils/collect-po-email-delivery-alerts';
import { useRouter } from 'next/navigation';
import { formatOfficeDateChip } from '../utils/format-date-label';
import {
  formatVancouverYmdChip,
  toVancouverYmdFromIso,
} from '../utils/vancouver-datetime';
import type {
  SupplierKey,
  SupplierEntry,
  StatusTab,
  PeriodKey,
  PostViewData,
  PoPanelMeta,
  ViewData,
  OfficePurchaseOrderBlock,
  SidebarCustomerGroup,
  Period,
  ShopifyOrderDraft,
} from '../types';
import type { CreatePoPayload } from '../components/MetaPanel';
import type { SeparatePoPayload } from '../components/PrePoView';
import {
  buildExpectedDateBuckets,
  expectedDateKeyFromPo,
  findBucketPageIndex,
  pickFirstPoInNewestExpectedBucket,
} from '../utils/sidebar-by-expected-date';
import {
  expectedDateKeysForPoTab,
  isOfficePoDeliveryDone,
  supplierRowHasFulfilledListPo,
  supplierRowHasOpenDeliveryPo,
} from '../utils/po-fulfillment-for-tab';
import {
  mergeViewDataWithOptimisticPoCreates,
  patchSupplierEntryAfterPoCreate,
} from '../utils/merge-optimistic-po-create';
import { mergeViewDataWithOptimisticEmailSent } from '../utils/merge-view-data-optimistic-email-sent';

/** PO Created tab: max expected-date chips in the bar; older dates go to “More”. */
const MAX_EXPECTED_DATE_CHIPS = 10;

/** When creating a PO from office drafts, default supplier ref from the line SKU. */
function supplierRefFromSku(sku: string | null | undefined): string | null {
  const t = sku?.trim();
  return t ? t : null;
}

/** Sidebar (non-Inbox): expected-date sections per “page” of dates. */
const EXPECTED_DATE_SIDEBAR_PAGE_SIZE = 5;

/** Vancouver `YYYY-MM-DD` from each without-PO draft (period chips vs `latestOrderedAt`). */
function shopifyDraftOrderedDaysForKey(
  supplierKey: SupplierKey,
  viewDataMap: Record<string, ViewData>,
): Set<string> {
  const vd = viewDataMap[supplierKey];
  if (!vd) return new Set();
  const drafts =
    vd.type === 'pre'
      ? vd.shopifyOrderDrafts
      : (vd.shopifyOrderDrafts ?? []);
  const days = new Set<string>();
  for (const d of drafts) {
    if (d.archivedAt) continue;
    const day = d.orderedAt ? toVancouverYmdFromIso(d.orderedAt) : undefined;
    if (day) days.add(day);
  }
  return days;
}

/** Merge server `viewDataMap` with pending archive/unarchive so list + chips update before refresh. */
function mergeViewDataWithOptimisticDraftArchive(
  viewDataMap: Record<string, ViewData>,
  optimisticArchived: ReadonlySet<string>,
  optimisticUnarchived: ReadonlySet<string>,
): Record<string, ViewData> {
  if (optimisticArchived.size === 0 && optimisticUnarchived.size === 0) {
    return viewDataMap;
  }
  const stamp = new Date().toISOString();
  const patchDraft = (d: ShopifyOrderDraft): ShopifyOrderDraft => {
    const serverArchived = d.archivedAt ?? null;
    let archivedAt = serverArchived;
    if (optimisticUnarchived.has(d.id)) archivedAt = null;
    else if (optimisticArchived.has(d.id)) archivedAt = stamp;
    if (archivedAt === serverArchived) return d;
    return { ...d, archivedAt };
  };
  let anyChange = false;
  const out: Record<string, ViewData> = { ...viewDataMap };
  for (const key of Object.keys(viewDataMap)) {
    const vd = viewDataMap[key];
    const drafts =
      vd.type === 'pre'
        ? vd.shopifyOrderDrafts
        : (vd.shopifyOrderDrafts ?? []);
    if (!drafts.length) continue;
    const next = drafts.map(patchDraft);
    if (!next.some((d, i) => d !== drafts[i])) continue;
    anyChange = true;
    out[key] =
      vd.type === 'pre'
        ? { ...vd, shopifyOrderDrafts: next }
        : { ...vd, shopifyOrderDrafts: next };
  }
  return anyChange ? out : viewDataMap;
}

export type OrderManagementViewProps = {
  initialStates: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  customerGroups: SidebarCustomerGroup[];
  statusTabCounts: Record<StatusTab, number>;
  defaultActiveKey: string | null;
  periods: Period[];
};

export function OrderManagementView({
  initialStates,
  viewDataMap,
  customerGroups,
  statusTabCounts: _statusTabCounts,
  defaultActiveKey,
  periods,
}: OrderManagementViewProps) {
  void _statusTabCounts;
  const [states, setStates] =
    useState<Record<SupplierKey, SupplierEntry>>(initialStates);

  /** After `router.refresh()` (e.g. Shopify sync), RSC passes new props; keep local `states` in sync. */
  useEffect(() => {
    setStates(initialStates);
  }, [initialStates]);

  const router = useRouter();

  const firstKey = defaultActiveKey ?? Object.keys(initialStates)[0] ?? null;

  const [activeKey, setActiveKey] = useState<SupplierKey>(firstKey ?? '');
  const [activeStatusTab, setActiveStatusTab] =
    useState<StatusTab>('without_po');
  const prevStatusTabRef = useRef<StatusTab | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>('all');
  const [selectedPoBlockId, setSelectedPoBlockId] = useState<string | null>(
    null,
  );
  const [showArchived, setShowArchived] = useState(false);

  // ── Draft inclusion state (lifted from OrderBlock checkboxes) ──
  const [draftInclusions, setDraftInclusions] = useState<
    Record<string, boolean[]>
  >({});
  const [draftPoNumber, setDraftPoNumber] = useState('');
  const [poNumberIsManual, setPoNumberIsManual] = useState(false);

  const [optimisticArchivedOrderIds, setOptimisticArchivedOrderIds] = useState(
    () => new Set<string>(),
  );
  const [optimisticUnarchivedOrderIds, setOptimisticUnarchivedOrderIds] =
    useState(() => new Set<string>());

  const [optimisticPoPatchesByKey, setOptimisticPoPatchesByKey] = useState<
    Partial<
      Record<
        SupplierKey,
        { newBlock: OfficePurchaseOrderBlock; removedDraftIds: string[] }
      >
    >
  >({});

  /** Alert row → tab switch: sidebar effect applies key + PO on next run (avoids Inbox forcing drafts). */
  const pendingPoNavigationRef = useRef<{
    supplierKey: SupplierKey;
    poId: string;
  } | null>(null);

  const [optimisticEmailSentAtByPoId, setOptimisticEmailSentAtByPoId] =
    useState<Record<string, string>>({});

  useEffect(() => {
    setOptimisticArchivedOrderIds(new Set());
    setOptimisticUnarchivedOrderIds(new Set());
    setOptimisticPoPatchesByKey({});
    setOptimisticEmailSentAtByPoId({});
  }, [viewDataMap]);

  const viewDataAfterDraftArchive = useMemo(
    () =>
      mergeViewDataWithOptimisticDraftArchive(
        viewDataMap,
        optimisticArchivedOrderIds,
        optimisticUnarchivedOrderIds,
      ),
    [viewDataMap, optimisticArchivedOrderIds, optimisticUnarchivedOrderIds],
  );

  const supplierCompanyByKey = useMemo(() => {
    const m: Record<SupplierKey, string> = {};
    for (const [k, e] of Object.entries(states)) {
      if (e) m[k as SupplierKey] = e.supplierCompany;
    }
    return m;
  }, [states]);

  const optimisticPoPatchSets = useMemo(() => {
    const out: Partial<
      Record<
        SupplierKey,
        {
          newBlock: OfficePurchaseOrderBlock;
          removedDraftIds: ReadonlySet<string>;
        }
      >
    > = {};
    for (const [k, v] of Object.entries(optimisticPoPatchesByKey)) {
      if (!v) continue;
      out[k as SupplierKey] = {
        newBlock: v.newBlock,
        removedDraftIds: new Set(v.removedDraftIds),
      };
    }
    return out;
  }, [optimisticPoPatchesByKey]);

  const patchedViewDataMap = useMemo(() => {
    const afterPoCreates = mergeViewDataWithOptimisticPoCreates(
      viewDataAfterDraftArchive,
      optimisticPoPatchSets,
      supplierCompanyByKey,
    );
    return mergeViewDataWithOptimisticEmailSent(
      afterPoCreates,
      optimisticEmailSentAtByPoId,
    );
  }, [
    viewDataAfterDraftArchive,
    optimisticPoPatchSets,
    supplierCompanyByKey,
    optimisticEmailSentAtByPoId,
  ]);

  const handleOptimisticPoEmailSent = useCallback((poId: string) => {
    setOptimisticEmailSentAtByPoId((prev) => ({
      ...prev,
      [poId]: new Date().toISOString(),
    }));
  }, []);

  const computedCounts = useMemo(() => {
    const counts = {
      without_po: 0,
      po_created: 0,
      fulfilled: 0,
      completed: 0,
      archived: 0,
    };
    for (const [key, e] of Object.entries(states)) {
      if (e.isArchived) {
        counts.archived++;
        continue;
      }
      if (e.withoutPoDraftCount > 0) counts.without_po++;
      const vd = patchedViewDataMap[key];
      if (e.poCreated && supplierRowHasOpenDeliveryPo(vd)) counts.po_created++;
      if (
        e.poCreated &&
        supplierRowHasFulfilledListPo(vd) &&
        !e.allCompleted
      ) {
        counts.fulfilled++;
      }
      if (e.allCompleted) counts.completed++;
    }
    return counts;
  }, [states, patchedViewDataMap]);

  const statusTabs: { id: StatusTab; label: string; count: number }[] = [
    { id: 'without_po', label: 'Inbox', count: computedCounts.without_po },
    { id: 'po_created', label: 'PO created', count: computedCounts.po_created },
    { id: 'fulfilled', label: 'Fulfilled', count: computedCounts.fulfilled },
    // Completed tab not in use for now
    // { id: 'completed', label: 'Completed', count: computedCounts.completed },
  ];

  const currentDrafts = useMemo(() => {
    const raw = patchedViewDataMap[activeKey];
    if (!raw) return [];
    const list =
      raw.type === 'pre'
        ? raw.shopifyOrderDrafts
        : (raw.shopifyOrderDrafts ?? []);
    if (showArchived) return list;
    return list.filter((d) => !d.archivedAt);
  }, [patchedViewDataMap, activeKey, showArchived]);

  useEffect(() => {
    const inc: Record<string, boolean[]> = {};
    for (const d of currentDrafts) {
      inc[d.id] = d.lineItems.map((li) => li.includeInPo);
    }
    setDraftInclusions(inc);
    setPoNumberIsManual(false);
    setDraftPoNumber('');
  }, [activeKey, currentDrafts]);

  const autoPoNumber = useMemo(() => {
    const included = currentDrafts.filter((d) => {
      const inc = draftInclusions[d.id];
      return inc
        ? inc.some(Boolean)
        : d.lineItems.some((li) => li.includeInPo);
    });
    if (included.length === 0) return '';

    // Pick the order with the most included line items
    const topOrder = [...included].sort((a, b) => {
      const aCount = (draftInclusions[a.id] ?? a.lineItems.map((li) => li.includeInPo))
        .filter(Boolean).length;
      const bCount = (draftInclusions[b.id] ?? b.lineItems.map((li) => li.includeInPo))
        .filter(Boolean).length;
      return bCount - aCount;
    })[0];

    const orderNum = topOrder.orderNumber.replace(/^#/, '');

    // Customer alias: same fallback as sidebar name display
    const custKey = activeKey.split('::')[0] ?? '';
    const custGroup = customerGroups.find((g) => g.id === custKey);
    const custLabel = custGroup?.name ?? '';

    const entry = states[activeKey];
    const supplierName = entry?.supplierCompany ?? '';

    return `${orderNum} ${custLabel} - ${supplierName}`;
  }, [currentDrafts, draftInclusions, activeKey, customerGroups, states]);

  const effectivePoNumber =
    poNumberIsManual && draftPoNumber ? draftPoNumber : autoPoNumber;

  const handleToggleInclude = useCallback(
    (orderId: string, itemIdx: number) => {
      setDraftInclusions((prev) => {
        const arr = [...(prev[orderId] ?? [])];
        arr[itemIdx] = !arr[itemIdx];
        return { ...prev, [orderId]: arr };
      });
    },
    [],
  );

  const handlePoNumberChange = useCallback((value: string) => {
    setDraftPoNumber(value);
    setPoNumberIsManual(true);
  }, []);

  const handlePoNumberReset = useCallback(() => {
    setDraftPoNumber('');
    setPoNumberIsManual(false);
  }, []);

  const handleCreatePo = useCallback(
    async (
      key: SupplierKey,
      payload?: CreatePoPayload,
    ): Promise<
      | { ok: true }
      | { ok: false; reason: 'duplicate_po_number' | 'unknown' }
    > => {
      const entry = states[key];
      if (!entry) return { ok: false, reason: 'unknown' };

      const parts = key.split('::');
      const supplierId =
        parts.length >= 2 && parts[1] !== 'without-po' ? parts[1] : null;

      const raw = patchedViewDataMap[key];
      const drafts =
        raw?.type === 'pre'
          ? raw.shopifyOrderDrafts
          : (raw?.shopifyOrderDrafts ?? []);

      const includedDrafts = drafts.filter((d) => {
        const inc = draftInclusions[d.id];
        return inc
          ? inc.some(Boolean)
          : d.lineItems.some((li) => li.includeInPo);
      });

      const shopifyOrderRefs = includedDrafts.map((d) => ({
        orderNumber: d.orderNumber,
      }));

      const lineItems = includedDrafts.flatMap((d) => {
        const inc = draftInclusions[d.id];
        return d.lineItems
          .filter((_, idx) => (inc ? inc[idx] : true))
          .map((li) => ({
            sku: li.sku,
            productTitle: li.productTitle,
            quantity: li.quantity,
            itemPrice: li.itemPrice ? parseFloat(li.itemPrice) : null,
            supplierRef: supplierRefFromSku(li.sku),
          }));
      });

      try {
        const res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poNumber: effectivePoNumber || 'AUTO',
            supplierId,
            currency: 'CAD',
            expectedDate: payload?.expectedDate ?? null,
            comment: payload?.comment ?? null,
            lineItems,
            shopifyOrderRefs,
            shippingAddress: payload?.shippingAddress ?? null,
            billingAddress: payload?.billingAddress ?? null,
            billingSameAsShipping: payload?.billingSameAsShipping ?? true,
          }),
        });

        if (res.ok) {
          const body = (await res.json().catch(() => null)) as {
            officeBlock?: OfficePurchaseOrderBlock;
          } | null;
          const officeBlock = body?.officeBlock?.id ? body.officeBlock : null;
          if (officeBlock) {
            const removedDraftIds = includedDrafts.map((d) => d.id);
            setOptimisticPoPatchesByKey((prev) => ({
              ...prev,
              [key]: { newBlock: officeBlock, removedDraftIds },
            }));
            setStates((prev) => {
              const e = prev[key];
              if (!e) return prev;
              return {
                ...prev,
                [key]: patchSupplierEntryAfterPoCreate({
                  entry: e,
                  newBlock: officeBlock,
                  removedDraftIds: new Set(removedDraftIds),
                  removedDrafts: includedDrafts,
                }),
              };
            });
            setSelectedPoBlockId(officeBlock.id);
          }
          router.refresh();
          return { ok: true };
        }
        const body = await res.json().catch(() => null);
        console.error('Create PO failed:', body?.error ?? res.statusText);
        if (res.status === 409 && body?.code === 'PO_NUMBER_TAKEN') {
          return { ok: false, reason: 'duplicate_po_number' };
        }
        return { ok: false, reason: 'unknown' };
      } catch (err) {
        console.error('Create PO error:', err);
        return { ok: false, reason: 'unknown' };
      }
    },
    [
      states,
      patchedViewDataMap,
      draftInclusions,
      effectivePoNumber,
      router,
      customerGroups,
    ],
  );

  const handleSeparatePo = useCallback(
    async (payload: SeparatePoPayload) => {
      const entry = states[activeKey];
      if (!entry) return;

      const parts = activeKey.split('::');
      const supplierId =
        parts.length >= 2 && parts[1] !== 'without-po' ? parts[1] : null;

      const raw = patchedViewDataMap[activeKey];
      const drafts =
        raw?.type === 'pre'
          ? raw.shopifyOrderDrafts
          : (raw?.shopifyOrderDrafts ?? []);
      const targetNorm = payload.shopifyOrderNumber.replace(/^#/, '').trim();
      const matchedDraft = drafts.find(
        (d) => d.orderNumber.replace(/^#/, '').trim() === targetNorm,
      );

      try {
        const res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poNumber: 'AUTO',
            supplierId,
            currency: 'CAD',
            expectedDate: payload.expectedDate,
            comment: payload.comment,
            lineItems: payload.lineItems.map((li) => ({
              sku: li.sku,
              productTitle: li.productTitle,
              quantity: li.quantity,
              itemPrice: li.itemPrice,
              supplierRef: supplierRefFromSku(li.sku),
            })),
            shopifyOrderRefs: [{ orderNumber: payload.shopifyOrderNumber }],
          }),
        });

        if (res.ok) {
          const body = (await res.json().catch(() => null)) as {
            officeBlock?: OfficePurchaseOrderBlock;
          } | null;
          const officeBlock = body?.officeBlock?.id ? body.officeBlock : null;
          if (officeBlock) {
            const removedDraftIds = matchedDraft ? [matchedDraft.id] : [];
            setOptimisticPoPatchesByKey((prev) => ({
              ...prev,
              [activeKey]: { newBlock: officeBlock, removedDraftIds },
            }));
            setStates((prev) => {
              const e = prev[activeKey];
              if (!e) return prev;
              return {
                ...prev,
                [activeKey]: patchSupplierEntryAfterPoCreate({
                  entry: e,
                  newBlock: officeBlock,
                  removedDraftIds: new Set(removedDraftIds),
                  removedDrafts: matchedDraft ? [matchedDraft] : [],
                }),
              };
            });
            setSelectedPoBlockId(officeBlock.id);
          }
          router.refresh();
          return;
        }
        const body = await res.json().catch(() => null);
        console.error('Separate PO failed:', body?.error ?? res.statusText);
      } catch (err) {
        console.error('Separate PO error:', err);
      }
    },
    [states, activeKey, router, customerGroups, patchedViewDataMap],
  );

  const handleEditPo = useCallback(
    async (
      poId: string,
      fields: {
        expectedDate?: string | null;
        comment?: string | null;
        poNumber?: string;
      },
    ): Promise<
      | { ok: true }
      | { ok: false; reason: 'duplicate_po_number' | 'unknown' }
    > => {
      try {
        const res = await fetch(`/api/purchase-orders/${poId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        });
        if (res.ok) {
          router.refresh();
          return { ok: true };
        }
        const body = await res.json().catch(() => null);
        console.error('Edit PO failed:', body?.error ?? res.statusText);
        if (res.status === 409 && body?.code === 'PO_NUMBER_TAKEN') {
          return { ok: false, reason: 'duplicate_po_number' };
        }
        return { ok: false, reason: 'unknown' };
      } catch (err) {
        console.error('Edit PO error:', err);
        return { ok: false, reason: 'unknown' };
      }
    },
    [router],
  );

  const handleDeletePo = useCallback(
    async (poId: string) => {
      try {
        const res = await fetch(`/api/purchase-orders/${poId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setSelectedPoBlockId(null);
          router.refresh();
          return;
        }
        const body = await res.json().catch(() => null);
        console.error('Delete PO failed:', body?.error ?? res.statusText);
      } catch (err) {
        console.error('Delete PO error:', err);
      }
    },
    [router],
  );

  const handleArchive = useCallback(
    async (key: SupplierKey) => {
      const e = states[key];
      if (!e) return;

      const snapshot = { ...e };
      const shopifyIds = [...e.archiveShopifyOrderIds];

      setOptimisticArchivedOrderIds((prev) => {
        const next = new Set(prev);
        for (const id of shopifyIds) next.add(id);
        return next;
      });
      setOptimisticUnarchivedOrderIds((prev) => {
        const next = new Set(prev);
        for (const id of shopifyIds) next.delete(id);
        return next;
      });

      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          isArchived: true,
          ...(shopifyIds.length > 0 ? { withoutPoDraftCount: 0 } : {}),
        },
      }));

      try {
        const res = await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseOrderIds:
              e.archivePurchaseOrderIds.length > 0
                ? e.archivePurchaseOrderIds
                : undefined,
            shopifyOrderIds:
              e.archiveShopifyOrderIds.length > 0
                ? e.archiveShopifyOrderIds
                : undefined,
            archive: true,
          }),
        });
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        router.refresh();
      } catch (err) {
        setStates((prev) => ({ ...prev, [key]: snapshot }));
        setOptimisticArchivedOrderIds((prev) => {
          const next = new Set(prev);
          for (const id of shopifyIds) next.delete(id);
          return next;
        });
        console.error('Archive error:', err);
      }
    },
    [states, router],
  );

  const handleUnarchive = useCallback(
    async (key: SupplierKey) => {
      const e = states[key];
      if (!e) return;

      const snapshot = { ...e };
      const shopifyIds = [...e.archiveShopifyOrderIds];

      const vd = viewDataMap[key];
      const draftRestoreCount =
        vd?.type === 'pre'
          ? vd.shopifyOrderDrafts.length
          : (vd?.shopifyOrderDrafts?.length ?? 0);

      setOptimisticUnarchivedOrderIds((prev) => {
        const next = new Set(prev);
        for (const id of shopifyIds) next.add(id);
        return next;
      });
      setOptimisticArchivedOrderIds((prev) => {
        const next = new Set(prev);
        for (const id of shopifyIds) next.delete(id);
        return next;
      });

      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          isArchived: false,
          ...(draftRestoreCount > 0
            ? { withoutPoDraftCount: draftRestoreCount }
            : {}),
        },
      }));

      try {
        const res = await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseOrderIds:
              e.archivePurchaseOrderIds.length > 0
                ? e.archivePurchaseOrderIds
                : undefined,
            shopifyOrderIds:
              e.archiveShopifyOrderIds.length > 0
                ? e.archiveShopifyOrderIds
                : undefined,
            archive: false,
          }),
        });
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        router.refresh();
      } catch (err) {
        setStates((prev) => ({ ...prev, [key]: snapshot }));
        setOptimisticUnarchivedOrderIds((prev) => {
          const next = new Set(prev);
          for (const id of shopifyIds) next.delete(id);
          return next;
        });
        console.error('Unarchive error:', err);
      }
    },
    [states, router, viewDataMap],
  );

  /** Archive only this Shopify order (e.g. from Separate PO dialog), not the whole supplier row. */
  const handleArchiveShopifyOrder = useCallback(
    async (shopifyOrderDbId: string) => {
      const key = activeKey;
      const entryBefore = states[key];

      setOptimisticArchivedOrderIds((prev) => new Set(prev).add(shopifyOrderDbId));
      setOptimisticUnarchivedOrderIds((prev) => {
        const n = new Set(prev);
        n.delete(shopifyOrderDbId);
        return n;
      });

      if (entryBefore) {
        setStates((prev) => {
          const e = prev[key];
          if (!e) return prev;
          const nextDraft = Math.max(0, e.withoutPoDraftCount - 1);
          const onlyDrafts = !e.poCreated;
          const rowFullyArchived = onlyDrafts && nextDraft === 0;
          return {
            ...prev,
            [key]: {
              ...e,
              withoutPoDraftCount: nextDraft,
              ...(rowFullyArchived ? { isArchived: true } : {}),
            },
          };
        });
      }

      try {
        const res = await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopifyOrderIds: [shopifyOrderDbId],
            archive: true,
          }),
        });
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        router.refresh();
      } catch (err) {
        setOptimisticArchivedOrderIds((prev) => {
          const n = new Set(prev);
          n.delete(shopifyOrderDbId);
          return n;
        });
        if (entryBefore) {
          setStates((prev) => ({ ...prev, [key]: { ...entryBefore } }));
        }
        console.error('Archive Shopify order error:', err);
      }
    },
    [router, activeKey, states],
  );

  const handleUnarchiveShopifyOrder = useCallback(
    async (shopifyOrderDbId: string) => {
      const key = activeKey;
      const entryBefore = states[key];

      setOptimisticUnarchivedOrderIds((prev) => new Set(prev).add(shopifyOrderDbId));
      setOptimisticArchivedOrderIds((prev) => {
        const n = new Set(prev);
        n.delete(shopifyOrderDbId);
        return n;
      });

      if (entryBefore) {
        setStates((prev) => {
          const e = prev[key];
          if (!e) return prev;
          return {
            ...prev,
            [key]: {
              ...e,
              withoutPoDraftCount: e.withoutPoDraftCount + 1,
              ...(!e.poCreated ? { isArchived: false } : {}),
            },
          };
        });
      }

      try {
        const res = await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopifyOrderIds: [shopifyOrderDbId],
            archive: false,
          }),
        });
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        router.refresh();
      } catch (err) {
        setOptimisticUnarchivedOrderIds((prev) => {
          const n = new Set(prev);
          n.delete(shopifyOrderDbId);
          return n;
        });
        if (entryBefore) {
          setStates((prev) => ({ ...prev, [key]: { ...entryBefore } }));
        }
        console.error('Unarchive Shopify order error:', err);
      }
    },
    [router, activeKey, states],
  );

  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (!showArchived) return;
    setActivePeriod('all');
    setCustomFrom('');
    setCustomTo('');
  }, [showArchived]);

  const { tabPeriods, moreExpectedPeriods, dateLabel } = useMemo(() => {
    if (showArchived) {
      return {
        tabPeriods: [] as Period[],
        moreExpectedPeriods: [] as Period[],
        dateLabel: 'Ordered at',
      };
    }

    if (
      activeStatusTab === 'po_created' ||
      activeStatusTab === 'fulfilled' ||
      activeStatusTab === 'completed'
    ) {
      const dateSet = new Set<string>();
      for (const [key, entry] of Object.entries(states)) {
        if (entry.isArchived) continue;
        const vd = patchedViewDataMap[key];
        let inTab = false;
        switch (activeStatusTab) {
          case 'po_created':
            inTab = entry.poCreated && supplierRowHasOpenDeliveryPo(vd);
            break;
          case 'fulfilled':
            inTab =
              entry.poCreated &&
              supplierRowHasFulfilledListPo(vd) &&
              !entry.allCompleted;
            break;
          case 'completed':
            inTab = entry.allCompleted;
            break;
          default:
            break;
        }
        if (!inTab) continue;
        if (activeStatusTab === 'completed') {
          for (const d of entry.expectedDates) {
            if (d) dateSet.add(d);
          }
        } else {
          for (const d of expectedDateKeysForPoTab(
            vd,
            activeStatusTab === 'po_created' ? 'po_created' : 'fulfilled',
          )) {
            if (d) dateSet.add(d);
          }
        }
      }
      const sortedAsc = [...dateSet].sort();
      const newestFirst = [...sortedAsc].reverse();
      const allPresets: Period[] = newestFirst.map((d) => {
        let displayLabel: string;
        try {
          displayLabel = formatOfficeDateChip(d);
        } catch {
          displayLabel = d;
        }
        return { id: `expected_${d}`, label: displayLabel, from: d, to: d };
      });
      return {
        tabPeriods: allPresets.slice(0, MAX_EXPECTED_DATE_CHIPS),
        moreExpectedPeriods: allPresets.slice(MAX_EXPECTED_DATE_CHIPS),
        dateLabel: 'Delivery Expected',
      };
    }

    if (activeStatusTab === 'inbox' || activeStatusTab === 'without_po') {
      const dateSet = new Set<string>();
      for (const entry of Object.values(states)) {
        if (entry.isArchived) continue;
        if (entry.withoutPoDraftCount <= 0) continue;
        if (entry.latestOrderedAt) dateSet.add(entry.latestOrderedAt);
      }
      const newestFirst = [...dateSet].sort().reverse();
      const allPresets: Period[] = newestFirst.map((d) => {
        let displayLabel: string;
        try {
          displayLabel = formatVancouverYmdChip(d);
        } catch {
          displayLabel = d;
        }
        return { id: `ordered_${d}`, label: displayLabel, from: d, to: d };
      });
      return {
        tabPeriods: allPresets.slice(0, MAX_EXPECTED_DATE_CHIPS),
        moreExpectedPeriods: allPresets.slice(MAX_EXPECTED_DATE_CHIPS),
        dateLabel: 'Ordered',
      };
    }

    return {
      tabPeriods: periods,
      moreExpectedPeriods: [] as Period[],
      dateLabel: 'Period',
    };
  }, [activeStatusTab, showArchived, states, periods, patchedViewDataMap]);

  const matchesStatusTab = useCallback(
    (e: SupplierEntry, vd: ViewData | undefined, tab: StatusTab): boolean => {
      if (showArchived) return e.isArchived;
      if (e.isArchived) return false;
      switch (tab) {
        case 'inbox':
        case 'without_po':
          return e.withoutPoDraftCount > 0;
        case 'po_created':
          return e.poCreated && supplierRowHasOpenDeliveryPo(vd);
        case 'fulfilled':
          return (
            e.poCreated &&
            supplierRowHasFulfilledListPo(vd) &&
            !e.allCompleted
          );
        case 'completed':
          return e.allCompleted;
        default:
          return false;
      }
    },
    [showArchived],
  );

  const getDateForTab = useCallback(
    (e: SupplierEntry, tab: StatusTab): string | null => {
      switch (tab) {
        case 'inbox':
        case 'without_po':
          return e.latestOrderedAt;
        case 'po_created':
          return e.expectedDate;
        case 'fulfilled':
          return e.fulfilledAt;
        case 'completed':
          return e.completedAt;
        default:
          return e.dateCreated;
      }
    },
    [],
  );

  const handlePeriodChange = useCallback((id: PeriodKey) => {
    setActivePeriod(id);
    if (id === 'all') {
      setCustomFrom('');
      setCustomTo('');
    }
  }, []);

  const handleAlertStripNavigate = useCallback(
    (it: PoEmailDeliveryAlertItem) => {
      const entry = states[it.supplierKey];
      const vd = patchedViewDataMap[it.supplierKey];
      const po =
        vd?.type === 'post'
          ? vd.purchaseOrders.find((p) => p.id === it.purchaseOrderId)
          : undefined;
      if (!entry || !po) return;
      const tab = pickStatusTabForEmailAlertPo({ entry, vd, po });
      pendingPoNavigationRef.current = {
        supplierKey: it.supplierKey,
        poId: it.purchaseOrderId,
      };
      setShowArchived(false);
      setActivePeriod('all');
      setActiveStatusTab(tab);
    },
    [states, patchedViewDataMap],
  );

  const matchesPeriod = useCallback(
    (supplierKey: SupplierKey, e: SupplierEntry, period: PeriodKey): boolean => {
      if (period === 'all') return true;

      if (showArchived && e.isArchived) {
        if (period === 'custom') {
          if (!customFrom && !customTo) return true;
          const raw = e.latestOrderedAt;
          if (!raw) return false;
          const day = raw.slice(0, 10);
          return (
            (!customFrom || day >= customFrom) && (!customTo || day <= customTo)
          );
        }
        return true;
      }

      if (period.startsWith('expected_')) {
        const target = period.replace('expected_', '');
        if (activeStatusTab === 'po_created') {
          return expectedDateKeysForPoTab(
            patchedViewDataMap[supplierKey],
            'po_created',
          ).includes(target);
        }
        if (activeStatusTab === 'fulfilled') {
          return expectedDateKeysForPoTab(
            patchedViewDataMap[supplierKey],
            'fulfilled',
          ).includes(target);
        }
        return e.expectedDates.includes(target);
      }

      if (period.startsWith('ordered_')) {
        const target = period.replace('ordered_', '');
        if (activeStatusTab === 'inbox' || activeStatusTab === 'without_po') {
          const draftDays = shopifyDraftOrderedDaysForKey(
            supplierKey,
            patchedViewDataMap,
          );
          return draftDays.has(target) || e.latestOrderedAt === target;
        }
        return e.latestOrderedAt === target;
      }

      if (period === 'custom') {
        if (!customFrom && !customTo) return true;
        if (
          activeStatusTab === 'po_created' ||
          activeStatusTab === 'fulfilled' ||
          activeStatusTab === 'completed'
        ) {
          const dateKeys =
            activeStatusTab === 'completed'
              ? e.expectedDates
              : expectedDateKeysForPoTab(
                  patchedViewDataMap[supplierKey],
                  activeStatusTab === 'po_created' ? 'po_created' : 'fulfilled',
                );
          return dateKeys.some(
            (ed) =>
              !!ed &&
              (!customFrom || ed >= customFrom) &&
              (!customTo || ed <= customTo),
          );
        }
        if (activeStatusTab === 'inbox' || activeStatusTab === 'without_po') {
          for (const day of shopifyDraftOrderedDaysForKey(
            supplierKey,
            patchedViewDataMap,
          )) {
            if (
              (!customFrom || day >= customFrom) &&
              (!customTo || day <= customTo)
            ) {
              return true;
            }
          }
          return false;
        }
        const d = getDateForTab(e, activeStatusTab);
        if (!d) return false;
        return (!customFrom || d >= customFrom) && (!customTo || d <= customTo);
      }
      const p = tabPeriods.find((pp) => pp.id === period);
      if (!p) return true;
      if (activeStatusTab === 'inbox' || activeStatusTab === 'without_po') {
        for (const day of shopifyDraftOrderedDaysForKey(
          supplierKey,
          patchedViewDataMap,
        )) {
          if (day >= p.from && day <= p.to) return true;
        }
      }
      const d = getDateForTab(e, activeStatusTab);
      if (!d) return false;
      return d >= p.from && d <= p.to;
    },
    [
      showArchived,
      customFrom,
      customTo,
      tabPeriods,
      activeStatusTab,
      getDateForTab,
      patchedViewDataMap,
    ],
  );

  const expectedDateBucketPoFilter = useMemo(():
    | ((po: OfficePurchaseOrderBlock) => boolean)
    | undefined => {
    if (activeStatusTab === 'po_created') {
      return (po) => po.id !== 'new' && !isOfficePoDeliveryDone(po);
    }
    if (activeStatusTab === 'fulfilled') {
      return (po) =>
        po.id !== 'new' &&
        isOfficePoDeliveryDone(po) &&
        po.status !== 'completed';
    }
    return undefined;
  }, [activeStatusTab]);

  const filteredGroups = useMemo(() => {
    const groups = customerGroups
      .map((g) => ({
        ...g,
        suppliers: g.suppliers.filter((s) => {
          const e = states[s.key];
          if (!e) return false;
          const vd = patchedViewDataMap[s.key];
          return (
            matchesStatusTab(e, vd, activeStatusTab) &&
            matchesPeriod(s.key, e, activePeriod)
          );
        }),
      }))
      .filter((g) => g.suppliers.length > 0);

    if (!showArchived) return groups;

    const sorted = [...groups].sort((a, b) => {
      const da = a.latestOrderDate ?? '';
      const db = b.latestOrderDate ?? '';
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    });

    return sorted.map((g) => ({
      ...g,
      suppliers: [...g.suppliers].sort((sa, sb) => {
        const ea = states[sa.key]?.latestOrderedAt ?? '';
        const eb = states[sb.key]?.latestOrderedAt ?? '';
        return eb.localeCompare(ea);
      }),
    }));
  }, [
    customerGroups,
    states,
    activeStatusTab,
    activePeriod,
    showArchived,
    patchedViewDataMap,
    matchesStatusTab,
    matchesPeriod,
  ]);

  /**
   * When the status tab changes or the current supplier row is no longer in the
   * filtered sidebar, select the default row for this tab (Inbox → first supplier +
   * drafts; PO tabs → first PO in the newest expected-date bucket, matching sidebar order).
   * Keeps one effect so a follow-up “repair” effect does not clear `selectedPoBlockId`.
   */
  useEffect(() => {
    const tabChanged =
      prevStatusTabRef.current != null &&
      prevStatusTabRef.current !== activeStatusTab;
    prevStatusTabRef.current = activeStatusTab;

    const pending = pendingPoNavigationRef.current;
    if (pending) {
      pendingPoNavigationRef.current = null;
      const visible = filteredGroups.some((g) =>
        g.suppliers.some((s) => s.key === pending.supplierKey),
      );
      if (visible) {
        setActiveKey(pending.supplierKey);
        setSelectedPoBlockId(pending.poId);
        return;
      }
    }

    const stillVisible = filteredGroups.some((g) =>
      g.suppliers.some((s) => s.key === activeKey),
    );
    if (stillVisible && !tabChanged) return;

    if (activeStatusTab === 'without_po') {
      setSelectedPoBlockId('__drafts__');
      const first = filteredGroups[0]?.suppliers[0];
      if (first) setActiveKey(first.key);
      else setActiveKey('');
      return;
    }

    setSelectedPoBlockId(null);

    const bucketOpts = {
      onlyExpectedDateKey: activePeriod.startsWith('expected_')
        ? activePeriod.replace('expected_', '')
        : null,
      bucketStyle: showArchived ? ('ordered' as const) : ('delivery_expected' as const),
      includePo: expectedDateBucketPoFilter,
    };
    const buckets = buildExpectedDateBuckets(
      filteredGroups,
      patchedViewDataMap,
      bucketOpts,
    );
    const fromNewest = pickFirstPoInNewestExpectedBucket(
      buckets,
      patchedViewDataMap,
    );
    if (fromNewest) {
      setActiveKey(fromNewest.supplierKey);
      setSelectedPoBlockId(fromNewest.poId);
      return;
    }

    const first = filteredGroups[0]?.suppliers[0];
    if (!first) {
      setActiveKey('');
      return;
    }
    setActiveKey(first.key);
    const raw = patchedViewDataMap[first.key];
    if (raw?.type === 'post' && raw.purchaseOrders.length > 0) {
      const filter = expectedDateBucketPoFilter;
      const candidates = raw.purchaseOrders.filter(
        (p) => p.id !== 'new' && (!filter || filter(p)),
      );
      const pick = candidates[0] ?? raw.purchaseOrders.find((p) => p.id !== 'new');
      if (pick) setSelectedPoBlockId(pick.id);
    }
  }, [
    activeKey,
    activeStatusTab,
    activePeriod,
    showArchived,
    filteredGroups,
    patchedViewDataMap,
    expectedDateBucketPoFilter,
  ]);

  /** Delivery-expected bucket for the selected PO — scopes sidebar highlight to one date section. */
  const selectionExpectedDateKey = useMemo(() => {
    if (!selectedPoBlockId || selectedPoBlockId === '__drafts__') return null;
    const vd = patchedViewDataMap[activeKey];
    if (!vd || vd.type !== 'post') return null;
    const po = vd.purchaseOrders.find((p) => p.id === selectedPoBlockId);
    return expectedDateKeyFromPo(po?.panelMeta?.expectedDate ?? null);
  }, [activeKey, selectedPoBlockId, patchedViewDataMap]);

  /** Inbox tab (without draft archive view): customer-first sidebar. Else: expected-date buckets. */
  const useInboxCustomerLayout =
    activeStatusTab === 'without_po' && !showArchived;

  const allExpectedBuckets = useMemo(() => {
    if (useInboxCustomerLayout) return null;
    const onlyKey = activePeriod.startsWith('expected_')
      ? activePeriod.replace('expected_', '')
      : null;
    return buildExpectedDateBuckets(filteredGroups, patchedViewDataMap, {
      onlyExpectedDateKey: onlyKey,
      bucketStyle: showArchived ? 'ordered' : 'delivery_expected',
      includePo: expectedDateBucketPoFilter,
    });
  }, [
    useInboxCustomerLayout,
    filteredGroups,
    patchedViewDataMap,
    activePeriod,
    showArchived,
    expectedDateBucketPoFilter,
  ]);

  useEffect(() => {
    if (useInboxCustomerLayout || !activePeriod.startsWith('expected_')) return;
    if (!allExpectedBuckets?.length) return;

    const valid = allExpectedBuckets.some((bucket) =>
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
    if (valid) return;

    const firstBucket = allExpectedBuckets[0];
    const firstCg = firstBucket.customerGroups[0];
    const firstSup = firstCg?.suppliers[0];
    if (!firstSup?.visiblePoIds?.length) return;
    setActiveKey(firstSup.key);
    setSelectedPoBlockId(firstSup.visiblePoIds[0]);
  }, [
    useInboxCustomerLayout,
    activePeriod,
    allExpectedBuckets,
    activeKey,
    selectedPoBlockId,
  ]);

  const [expectedDateSidebarPage, setExpectedDateSidebarPage] = useState(0);

  const expectedDateSidebarPageCount = useMemo(() => {
    if (!allExpectedBuckets?.length) return 1;
    return Math.max(
      1,
      Math.ceil(allExpectedBuckets.length / EXPECTED_DATE_SIDEBAR_PAGE_SIZE),
    );
  }, [allExpectedBuckets]);

  const pagedExpectedBuckets = useMemo(() => {
    if (!allExpectedBuckets) return null;
    const start = expectedDateSidebarPage * EXPECTED_DATE_SIDEBAR_PAGE_SIZE;
    return allExpectedBuckets.slice(
      start,
      start + EXPECTED_DATE_SIDEBAR_PAGE_SIZE,
    );
  }, [allExpectedBuckets, expectedDateSidebarPage]);

  useEffect(() => {
    setExpectedDateSidebarPage(0);
  }, [activeStatusTab, showArchived, activePeriod, filteredGroups]);

  useEffect(() => {
    if (useInboxCustomerLayout || !allExpectedBuckets?.length) return;
    if (
      selectedPoBlockId === '__drafts__' ||
      selectedPoBlockId === null ||
      selectedPoBlockId === undefined
    ) {
      return;
    }
    const page = findBucketPageIndex(
      allExpectedBuckets,
      EXPECTED_DATE_SIDEBAR_PAGE_SIZE,
      activeKey,
      selectedPoBlockId,
    );
    setExpectedDateSidebarPage(page);
  }, [
    activeKey,
    selectedPoBlockId,
    allExpectedBuckets,
    useInboxCustomerLayout,
  ]);

  const entry = states[activeKey] ?? null;

  const rawViewData = entry ? patchedViewDataMap[activeKey] : undefined;

  const viewData: ViewData =
    entry && entry.poCreated && rawViewData?.type === 'pre'
      ? ({
          type: 'post',
          purchaseOrders: [
            {
              id: 'new',
              poNumber: 'NEW',
              status: 'unfulfilled',
              currency: 'CAD',
              isAuto: false,
              title: 'Items for PO',
              shopifyOrderCount: rawViewData.shopifyOrderDrafts.filter(
                (d) => !d.archivedAt,
              ).length,
              lineItems: [],
              supplierOrderChannelType: entry.supplierOrderChannelType,
              poCreatedAt: new Date().toISOString(),
              legacyExternalId: null,
              emailDeliveryOutstanding: false,
            },
          ],
        } satisfies PostViewData)
      : (rawViewData ?? { type: 'pre' as const, shopifyOrderDrafts: [] });

  useEffect(() => {
    if (!entry) return;
    const raw = patchedViewDataMap[activeKey];
    if (!raw) return;

    const draftList =
      raw.type === 'pre'
        ? raw.shopifyOrderDrafts
        : (raw.shopifyOrderDrafts ?? []);
    const draftCount = draftList.filter((d) => !d.archivedAt).length;

    if (
      draftCount > 0 &&
      (activeStatusTab === 'without_po' || activeStatusTab === 'inbox')
    ) {
      setSelectedPoBlockId('__drafts__');
      return;
    }

    const vd =
      entry.poCreated && raw.type === 'pre'
        ? ({
            type: 'post',
            purchaseOrders: [
              {
                id: 'new',
                poNumber: 'NEW',
                status: 'unfulfilled',
                currency: 'CAD',
                isAuto: false,
                title: 'Items for PO',
                shopifyOrderCount: draftList.filter((d) => !d.archivedAt)
                  .length,
                lineItems: [],
                supplierOrderChannelType: entry.supplierOrderChannelType,
                poCreatedAt: new Date().toISOString(),
                legacyExternalId: null,
                emailDeliveryOutstanding: false,
              },
            ],
          } satisfies PostViewData)
        : raw;
    if (vd.type !== 'post') {
      setSelectedPoBlockId(null);
      return;
    }
    if (vd.purchaseOrders.length === 0) {
      setSelectedPoBlockId(null);
      return;
    }
    setSelectedPoBlockId((prev) => {
      const stillValid = prev && vd.purchaseOrders.some((b) => b.id === prev);
      if (stillValid) return prev;
      return vd.purchaseOrders[0].id;
    });
  }, [activeKey, activeStatusTab, entry?.poCreated, patchedViewDataMap, entry]);

  let selectedPoPanelMeta: PoPanelMeta | undefined;
  if (viewData.type === 'post' && selectedPoBlockId) {
    selectedPoPanelMeta = viewData.purchaseOrders.find(
      (b) => b.id === selectedPoBlockId,
    )?.panelMeta;
  }

  const customerAddressDefaults = useMemo(() => {
    const custKey = activeKey.split('::')[0] ?? '';
    const group = customerGroups.find((g) => g.id === custKey);
    return {
      shipping: group?.defaultShippingAddress ?? null,
      billing: group?.defaultBillingAddress ?? null,
      billingSame: group?.billingSameAsShipping ?? true,
    };
  }, [activeKey, customerGroups]);

  const selectedPoPrintBlock =
    viewData.type === 'post' && selectedPoBlockId && selectedPoBlockId !== '__drafts__'
      ? (viewData.purchaseOrders.find((b) => b.id === selectedPoBlockId) ?? null)
      : null;

  const poEmailDeliveryAlertItems = useMemo(
    () =>
      collectPoEmailDeliveryAlerts({
        viewDataMap: patchedViewDataMap,
        states,
        customerGroups,
      }),
    [patchedViewDataMap, states, customerGroups],
  );

  const poPrintHeadline = useMemo(() => {
    const custKey = activeKey.split('::')[0] ?? '';
    const g = customerGroups.find((c) => c.id === custKey);
    return g?.company?.trim() || g?.name?.trim() || null;
  }, [activeKey, customerGroups]);

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-background">
      <PoEmailDeliveryAlertsStrip
        items={poEmailDeliveryAlertItems}
        onNavigateToPo={handleAlertStripNavigate}
        onSent={(poId) => {
          handleOptimisticPoEmailSent(poId);
          router.refresh();
        }}
      />
      <StatusTabBar
        tabs={statusTabs}
        activeTab={activeStatusTab}
        onChange={(tab) => {
          setShowArchived(false);
          setActivePeriod('all');
          setActiveStatusTab(tab);
        }}
        archivedCount={computedCounts.archived}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((v) => !v)}
      />
      <PeriodFilterBar
        key={showArchived ? 'archived-period' : 'main-period'}
        periods={tabPeriods}
        morePeriods={moreExpectedPeriods}
        activePeriod={activePeriod}
        onPeriodChange={handlePeriodChange}
        onCustomApply={(from, to) => {
          setCustomFrom(from);
          setCustomTo(to);
          setActivePeriod('custom');
        }}
        dateLabel={dateLabel}
        orderedDateOnly={showArchived}
        archiveFrom={showArchived ? customFrom : undefined}
        archiveTo={showArchived ? customTo : undefined}
        onArchiveFromChange={showArchived ? setCustomFrom : undefined}
        onArchiveToChange={showArchived ? setCustomTo : undefined}
      />

      <div className="flex min-h-[600px] overflow-hidden">
        <Sidebar
          layout={useInboxCustomerLayout ? 'customer' : 'expected_date'}
          customerGroups={filteredGroups}
          expectedDateBuckets={
            useInboxCustomerLayout ? undefined : (pagedExpectedBuckets ?? [])
          }
          expectedDatePage={expectedDateSidebarPage}
          expectedDatePageCount={expectedDateSidebarPageCount}
          onExpectedDatePageChange={setExpectedDateSidebarPage}
          activeKey={activeKey}
          states={states}
          viewDataMap={patchedViewDataMap}
          onSelect={setActiveKey}
          selectedPoBlockId={selectedPoBlockId}
          selectionExpectedDateKey={selectionExpectedDateKey}
          showArchived={showArchived}
          onSelectPo={(key, poBlockId) => {
            setActiveKey(key);
            setSelectedPoBlockId(poBlockId);
          }}
          activeStatusTab={activeStatusTab}
        />

        {entry ? (
          <div className="flex flex-col flex-1 min-w-0">
            <CenterBar
              entry={entry}
              activeKey={activeKey}
              poPanelMeta={selectedPoPanelMeta}
              selectedPoBlockId={selectedPoBlockId}
            />

            <OrderProcessingBlock
              entry={entry}
              includePoEmailTools={
                entry.poCreated && selectedPoBlockId !== '__drafts__'
              }
              poEmailSentAt={selectedPoPanelMeta?.emailSentAt ?? null}
              poEmailDeliveryOutstanding={
                selectedPoPrintBlock?.emailDeliveryOutstanding ?? false
              }
              selectedPoBlockId={selectedPoBlockId}
              emailDeliveries={selectedPoPanelMeta?.emailDeliveries ?? []}
              onPoEmailSent={handleOptimisticPoEmailSent}
              onSendEmailComplete={() => router.refresh()}
            />

            <div className="flex flex-1 min-h-0 bg-muted/30">
              <div className="flex-1 min-w-0 p-3.5 overflow-y-auto">
                {selectedPoBlockId === '__drafts__' &&
                viewData.type === 'post' &&
                viewData.shopifyOrderDrafts?.length ? (
                  <PrePoView
                    viewData={{
                      type: 'pre',
                      shopifyOrderDrafts: viewData.shopifyOrderDrafts,
                    }}
                    inclusions={draftInclusions}
                    onToggleInclude={handleToggleInclude}
                    onSeparatePo={handleSeparatePo}
                    showArchived={showArchived}
                    onArchiveShopifyOrder={handleArchiveShopifyOrder}
                    onUnarchiveShopifyOrder={handleUnarchiveShopifyOrder}
                    purchaseOrderId={
                      (
                        viewData.purchaseOrders.find((p) => p.id !== 'new') ??
                        viewData.purchaseOrders[0]
                      )?.id ?? null
                    }
                  />
                ) : viewData.type === 'pre' ? (
                  <PrePoView
                    viewData={viewData}
                    inclusions={draftInclusions}
                    onToggleInclude={handleToggleInclude}
                    onSeparatePo={handleSeparatePo}
                    showArchived={showArchived}
                    onArchiveShopifyOrder={handleArchiveShopifyOrder}
                    onUnarchiveShopifyOrder={handleUnarchiveShopifyOrder}
                  />
                ) : (
                  <PostPoView
                    viewData={viewData}
                    selectedPoBlockId={selectedPoBlockId}
                  />
                )}
              </div>
              <MetaPanel
                entry={entry}
                activeKey={activeKey}
                onCreatePo={handleCreatePo}
                onEditPo={handleEditPo}
                onDeletePo={handleDeletePo}
                onPoEmailSent={handleOptimisticPoEmailSent}
                poPanelMeta={selectedPoPanelMeta}
                selectedPoBlockId={selectedPoBlockId}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                draftPoNumber={effectivePoNumber}
                poNumberIsManual={poNumberIsManual}
                onPoNumberChange={handlePoNumberChange}
                onPoNumberReset={handlePoNumberReset}
                customerDefaultShipping={customerAddressDefaults.shipping}
                customerDefaultBilling={customerAddressDefaults.billing}
                customerBillingSameAsShipping={customerAddressDefaults.billingSame}
                poPrintBlock={selectedPoPrintBlock}
                poPrintHeadline={poPrintHeadline}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-w-0 items-center justify-center bg-muted/30">
            <span className="text-sm text-muted-foreground">
              No order selected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

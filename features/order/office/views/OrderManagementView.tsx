'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { StatusTabBar } from '../components/StatusTabBar';
import { PeriodFilterBar } from '../components/PeriodFilterBar';
import { Sidebar } from '../components/Sidebar';
import { CenterBar } from '../components/CenterBar';
import { PrePoView } from '../components/PrePoView';
import { PostPoView } from '../components/PostPoView';
import { CommPanel } from '../components/CommPanel';
import { MetaPanel } from '../components/MetaPanel';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import type {
  SupplierKey,
  SupplierEntry,
  StatusTab,
  PeriodKey,
  PostViewData,
  PoPanelMeta,
  ViewData,
  SidebarCustomerGroup,
  Period,
} from '../types';
import type { CreatePoPayload } from '../components/MetaPanel';
import type { SeparatePoPayload } from '../components/PrePoView';
import {
  buildExpectedDateBuckets,
  expectedDateKeyFromPo,
  findBucketPageIndex,
  pickFirstPoInNewestExpectedBucket,
} from '../utils/sidebar-by-expected-date';

/** PO Created tab: max expected-date chips in the bar; older dates go to “More”. */
const MAX_EXPECTED_DATE_CHIPS = 10;

/** Sidebar (non-Inbox): expected-date sections per “page” of dates. */
const EXPECTED_DATE_SIDEBAR_PAGE_SIZE = 5;

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
  statusTabCounts,
  defaultActiveKey,
  periods,
}: OrderManagementViewProps) {
  const [states, setStates] =
    useState<Record<SupplierKey, SupplierEntry>>(initialStates);

  /** After `router.refresh()` (e.g. Shopify sync), RSC passes new props; keep local `states` in sync. */
  useEffect(() => {
    setStates(initialStates);
  }, [initialStates]);

  const computedCounts = useMemo(() => {
    const counts = {
      without_po: 0,
      po_created: 0,
      fulfilled: 0,
      completed: 0,
      archived: 0,
    };
    for (const e of Object.values(states)) {
      if (e.isArchived) {
        counts.archived++;
        continue;
      }
      if (e.withoutPoDraftCount > 0) counts.without_po++;
      if (e.poCreated && !e.allFulfilled) counts.po_created++;
      if (e.allFulfilled && !e.allCompleted) counts.fulfilled++;
      if (e.allCompleted) counts.completed++;
    }
    return counts;
  }, [states]);

  const statusTabs: { id: StatusTab; label: string; count: number }[] = [
    { id: 'without_po', label: 'Inbox', count: computedCounts.without_po },
    { id: 'po_created', label: 'PO created', count: computedCounts.po_created },
    { id: 'fulfilled', label: 'Fulfilled', count: computedCounts.fulfilled },
    // Completed tab not in use for now
    // { id: 'completed', label: 'Completed', count: computedCounts.completed },
  ];

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

  const currentDrafts = useMemo(() => {
    const raw = viewDataMap[activeKey];
    if (!raw) return [];
    if (raw.type === 'pre') return raw.shopifyOrderDrafts;
    return raw.shopifyOrderDrafts ?? [];
  }, [viewDataMap, activeKey]);

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

      const raw = viewDataMap[key];
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
    [states, viewDataMap, draftInclusions, effectivePoNumber, router],
  );

  const handleSeparatePo = useCallback(
    async (payload: SeparatePoPayload) => {
      const entry = states[activeKey];
      if (!entry) return;

      const parts = activeKey.split('::');
      const supplierId =
        parts.length >= 2 && parts[1] !== 'without-po' ? parts[1] : null;

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
            })),
            shopifyOrderRefs: [{ orderNumber: payload.shopifyOrderNumber }],
          }),
        });

        if (res.ok) {
          router.refresh();
          return;
        }
        const body = await res.json().catch(() => null);
        console.error('Separate PO failed:', body?.error ?? res.statusText);
      } catch (err) {
        console.error('Separate PO error:', err);
      }
    },
    [states, activeKey, router],
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

      setStates((prev) => ({
        ...prev,
        [key]: { ...prev[key], isArchived: true },
      }));

      try {
        await fetch('/api/archive', {
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
        router.refresh();
      } catch (err) {
        setStates((prev) => ({
          ...prev,
          [key]: { ...prev[key], isArchived: false },
        }));
        console.error('Archive error:', err);
      }
    },
    [states, router],
  );

  const handleUnarchive = useCallback(
    async (key: SupplierKey) => {
      const e = states[key];
      if (!e) return;

      setStates((prev) => ({
        ...prev,
        [key]: { ...prev[key], isArchived: false },
      }));

      try {
        await fetch('/api/archive', {
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
        router.refresh();
      } catch (err) {
        setStates((prev) => ({
          ...prev,
          [key]: { ...prev[key], isArchived: true },
        }));
        console.error('Unarchive error:', err);
      }
    },
    [states, router],
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
      for (const entry of Object.values(states)) {
        if (entry.isArchived) continue;
        let inTab = false;
        switch (activeStatusTab) {
          case 'po_created':
            inTab = entry.poCreated && !entry.allFulfilled;
            break;
          case 'fulfilled':
            inTab = entry.allFulfilled && !entry.allCompleted;
            break;
          case 'completed':
            inTab = entry.allCompleted;
            break;
          default:
            break;
        }
        if (!inTab) continue;
        for (const d of entry.expectedDates) {
          if (d) dateSet.add(d);
        }
      }
      const sortedAsc = [...dateSet].sort();
      const newestFirst = [...sortedAsc].reverse();
      const allPresets: Period[] = newestFirst.map((d) => {
        let displayLabel: string;
        try {
          displayLabel = format(parseISO(d), 'MMM d');
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
          displayLabel = format(parseISO(d), 'MMM d');
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
  }, [activeStatusTab, showArchived, states, periods]);

  const matchesStatusTab = useCallback(
    (e: SupplierEntry, tab: StatusTab): boolean => {
      if (showArchived) return e.isArchived;
      if (e.isArchived) return false;
      switch (tab) {
        case 'inbox':
        case 'without_po':
          return e.withoutPoDraftCount > 0;
        case 'po_created':
          return e.poCreated && !e.allFulfilled;
        case 'fulfilled':
          return e.allFulfilled && !e.allCompleted;
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

  const matchesPeriod = useCallback(
    (e: SupplierEntry, period: PeriodKey): boolean => {
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
        return e.expectedDates.includes(target);
      }

      if (period.startsWith('ordered_')) {
        const target = period.replace('ordered_', '');
        return e.latestOrderedAt === target;
      }

      if (period === 'custom') {
        if (!customFrom && !customTo) return true;
        if (
          activeStatusTab === 'po_created' ||
          activeStatusTab === 'fulfilled' ||
          activeStatusTab === 'completed'
        ) {
          return e.expectedDates.some(
            (ed) =>
              !!ed &&
              (!customFrom || ed >= customFrom) &&
              (!customTo || ed <= customTo),
          );
        }
        const d = getDateForTab(e, activeStatusTab);
        if (!d) return false;
        return (!customFrom || d >= customFrom) && (!customTo || d <= customTo);
      }
      const p = tabPeriods.find((pp) => pp.id === period);
      if (!p) return true;
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
    ],
  );

  const filteredGroups = useMemo(() => {
    const groups = customerGroups
      .map((g) => ({
        ...g,
        suppliers: g.suppliers.filter((s) => {
          const e = states[s.key];
          if (!e) return false;
          return (
            matchesStatusTab(e, activeStatusTab) &&
            matchesPeriod(e, activePeriod)
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
    };
    const buckets = buildExpectedDateBuckets(
      filteredGroups,
      viewDataMap,
      bucketOpts,
    );
    const fromNewest = pickFirstPoInNewestExpectedBucket(buckets, viewDataMap);
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
    const raw = viewDataMap[first.key];
    if (raw?.type === 'post' && raw.purchaseOrders.length > 0) {
      const skipNew = raw.purchaseOrders.filter((p) => p.id !== 'new');
      const pick = skipNew[0] ?? raw.purchaseOrders[0];
      setSelectedPoBlockId(pick.id);
    }
  }, [
    activeKey,
    activeStatusTab,
    activePeriod,
    showArchived,
    filteredGroups,
    viewDataMap,
  ]);

  /** Delivery-expected bucket for the selected PO — scopes sidebar highlight to one date section. */
  const selectionExpectedDateKey = useMemo(() => {
    if (!selectedPoBlockId || selectedPoBlockId === '__drafts__') return null;
    const vd = viewDataMap[activeKey];
    if (!vd || vd.type !== 'post') return null;
    const po = vd.purchaseOrders.find((p) => p.id === selectedPoBlockId);
    return expectedDateKeyFromPo(po?.panelMeta?.expectedDate ?? null);
  }, [activeKey, selectedPoBlockId, viewDataMap]);

  /** Inbox tab (without draft archive view): customer-first sidebar. Else: expected-date buckets. */
  const useInboxCustomerLayout =
    activeStatusTab === 'without_po' && !showArchived;

  const allExpectedBuckets = useMemo(() => {
    if (useInboxCustomerLayout) return null;
    const onlyKey = activePeriod.startsWith('expected_')
      ? activePeriod.replace('expected_', '')
      : null;
    return buildExpectedDateBuckets(filteredGroups, viewDataMap, {
      onlyExpectedDateKey: onlyKey,
      bucketStyle: showArchived ? 'ordered' : 'delivery_expected',
    });
  }, [useInboxCustomerLayout, filteredGroups, viewDataMap, activePeriod, showArchived]);

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

  const rawViewData = entry ? viewDataMap[activeKey] : undefined;

  const viewData: ViewData =
    entry?.poCreated && rawViewData?.type === 'pre'
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
              shopifyOrderCount: rawViewData.shopifyOrderDrafts.length,
              lineItems: [],
            },
          ],
        } satisfies PostViewData)
      : (rawViewData ?? { type: 'pre' as const, shopifyOrderDrafts: [] });

  useEffect(() => {
    if (!entry) return;
    const raw = viewDataMap[activeKey];
    if (!raw) return;

    const draftCount =
      raw.type === 'pre'
        ? raw.shopifyOrderDrafts.length
        : (raw.shopifyOrderDrafts?.length ?? 0);

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
                shopifyOrderCount: raw.shopifyOrderDrafts.length,
                lineItems: [],
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
  }, [activeKey, activeStatusTab, entry?.poCreated, viewDataMap, entry]);

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

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-background">
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
          viewDataMap={viewDataMap}
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
                    onArchive={() => handleArchive(activeKey)}
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
                    onArchive={() => handleArchive(activeKey)}
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

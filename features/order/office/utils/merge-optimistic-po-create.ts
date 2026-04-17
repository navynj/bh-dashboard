import type {
  OfficePurchaseOrderBlock,
  PostViewData,
  SupplierEntry,
  SupplierKey,
  ViewData,
} from '../types';

function clonePoBlock(b: OfficePurchaseOrderBlock): OfficePurchaseOrderBlock {
  return {
    ...b,
    lineItems: b.lineItems.map((li) => ({ ...li })),
    panelMeta: b.panelMeta
      ? {
          ...b.panelMeta,
          linkedShopifyOrders: b.panelMeta.linkedShopifyOrders.map((o) => ({
            ...o,
          })),
        }
      : undefined,
  };
}

function decoratePostViewMultiPo(
  blocks: OfficePurchaseOrderBlock[],
  supplierName: string,
): Omit<PostViewData, 'shopifyOrderDrafts'> {
  const cloned = blocks.map(clonePoBlock);
  const isMulti = cloned.length > 1;
  if (isMulti) {
    for (const b of cloned) {
      b.subtreeRowLabel = `PO #${b.poNumber}${b.isAuto ? '' : ' — custom'}`;
    }
  } else {
    for (const b of cloned) {
      delete b.subtreeRowLabel;
    }
  }
  return {
    type: 'post',
    purchaseOrders: cloned,
    ...(isMulti && {
      subtreeParentLabel: `${supplierName} · ${cloned.length} POs`,
      multiPoSubtree: true,
    }),
  };
}

/**
 * Merges server `viewData` with a PO that was just created locally so the office
 * inbox updates immediately before `router.refresh()` finishes.
 */
export function mergeViewDataWithOptimisticPoCreates(
  viewDataMap: Record<SupplierKey, ViewData>,
  patches: Readonly<
    Partial<Record<SupplierKey, { newBlock: OfficePurchaseOrderBlock; removedDraftIds: ReadonlySet<string> } | undefined>>
  >,
  supplierNameByKey: Readonly<Record<SupplierKey, string>>,
): Record<SupplierKey, ViewData> {
  let any = false;
  const out: Record<SupplierKey, ViewData> = { ...viewDataMap };

  for (const key of Object.keys(viewDataMap)) {
    const patch = patches[key];
    if (!patch) continue;

    const vd = viewDataMap[key];
    if (!vd) continue;

    const drafts =
      vd.type === 'pre'
        ? vd.shopifyOrderDrafts
        : (vd.shopifyOrderDrafts ?? []);

    const nextDrafts = drafts.filter((d) => !patch.removedDraftIds.has(d.id));

    const existingPos =
      vd.type === 'post' ? vd.purchaseOrders.filter((p) => p.id !== 'new') : [];

    if (existingPos.some((p) => p.id === patch.newBlock.id)) {
      continue;
    }

    const mergedPos = [clonePoBlock(patch.newBlock), ...existingPos.map(clonePoBlock)];
    const supplierName = supplierNameByKey[key] ?? 'Supplier';

    const preserveLabels =
      vd.type === 'post'
        ? { label: vd.label, extraLabel: vd.extraLabel }
        : {};

    const basePost = decoratePostViewMultiPo(mergedPos, supplierName);
    const next: PostViewData = {
      ...preserveLabels,
      ...basePost,
      ...(nextDrafts.length > 0 ? { shopifyOrderDrafts: nextDrafts } : {}),
    };

    any = true;
    out[key] = next;
  }

  return any ? out : viewDataMap;
}

/** Bumps sidebar/meta counters after a successful PO create. */
export function patchSupplierEntryAfterPoCreate(args: {
  entry: SupplierEntry;
  newBlock: OfficePurchaseOrderBlock;
  removedDraftIds: ReadonlySet<string>;
  removedDrafts: ReadonlyArray<{ id: string; archivedAt?: string | null }>;
}): SupplierEntry {
  const { entry, newBlock, removedDraftIds, removedDrafts } = args;
  const m = newBlock.panelMeta;
  if (!m) return { ...entry, poCreated: true };

  const removedOpenDraftCount = removedDrafts.filter(
    (d) => removedDraftIds.has(d.id) && !d.archivedAt,
  ).length;

  const nextDraftCount = Math.max(0, entry.withoutPoDraftCount - removedOpenDraftCount);
  const nextArchivePoIds = entry.archivePurchaseOrderIds.includes(newBlock.id)
    ? entry.archivePurchaseOrderIds
    : [...entry.archivePurchaseOrderIds, newBlock.id];

  const fulfillDone = entry.fulfillDoneCount + m.fulfillDoneCount;
  const fulfillTotal = entry.fulfillTotalCount + m.fulfillTotalCount;
  const fulfillPending = fulfillTotal - fulfillDone;

  const expectedDatesSet = new Set(entry.expectedDates);
  if (m.expectedDate) expectedDatesSet.add(m.expectedDate);
  const expectedDates = [...expectedDatesSet].sort();

  const nextReferenceKey = entry.referenceKey.includes('without-po')
    ? newBlock.poNumber
    : `${entry.referenceKey}+${newBlock.poNumber}`;

  const allFulfilled = fulfillTotal > 0 && fulfillPending === 0;

  return {
    ...entry,
    poCreated: true,
    withoutPoDraftCount: nextDraftCount,
    archivePurchaseOrderIds: nextArchivePoIds,
    fulfillDoneCount: fulfillDone,
    fulfillPendingCount: fulfillPending,
    fulfillTotalCount: fulfillTotal,
    expectedDates,
    referenceKey: nextReferenceKey,
    emailSent:
      entry.supplierOrderChannelType !== 'email'
        ? entry.emailSent
        : entry.emailSent && !newBlock.emailDeliveryOutstanding,
    allFulfilled,
    allCompleted: false,
  };
}

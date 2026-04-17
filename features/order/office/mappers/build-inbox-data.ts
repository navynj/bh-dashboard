/**
 * Server-side aggregation: Prisma query results → full props for OrderManagementView.
 *
 * Groups POs by **ShopifyCustomer** (DB-based, not runtime API), builds sidebar
 * structure + per-supplier view data, and computes status tab counts.
 *
 * Without-PO orders are grouped by **line-item** vendor → supplier (via
 * `ShopifyVendorMapping`). A single Shopify order may appear under multiple
 * supplier rows (one slice per supplier), each showing only that supplier’s lines.
 *
 * All data comes from the DB — no live Shopify API calls needed.
 */

import { mapPrismaPoToBlock } from './map-purchase-order';
import type { PrismaPoWithRelations } from './map-purchase-order';
import type {
  SupplierKey,
  SupplierEntry,
  ViewData,
  PostViewData,
  SidebarCustomerGroup,
  SidebarSupplierRow,
  PoPill,
  StatusTab,
  ShopifyOrderDraft,
  CustomerAddress,
} from '../types';
import type { Prisma } from '@prisma/client';
import { sortPrePoLineDraftsByProductTitleAsc } from '../utils/sort-lines-by-product-title';
import {
  legacyFallbackOrderChannel,
  type SupplierOrderChannelType,
  type EmailOrderChannelPayload,
  type OrderLinkChannelPayload,
  type DirectInstructionChannelPayload,
} from '@/lib/order/supplier-order-channel';
import { formatOfficeDateFromDate } from '../utils/format-date-label';
import { toVancouverYmd } from '../utils/vancouver-datetime';
import {
  isOfficePoDeliveryDone,
  supplierRowHasFulfilledListPo,
  supplierRowHasOpenDeliveryPo,
} from '../utils/po-fulfillment-for-tab';
import { computeEmailDeliveryOutstanding } from '../utils/po-email-delivery-policy';

// ─── DB payload types ─────────────────────────────────────────────────────────

type PrismaSupplierGroup = Prisma.SupplierGroupGetPayload<{
  include: { suppliers: true };
}>;

type SupplierScalar = PrismaSupplierGroup['suppliers'][0];

function buildChannelEntryFields(supplier: SupplierScalar | undefined): Pick<
  SupplierEntry,
  | 'supplierOrderChannelSummary'
  | 'supplierContactEmail'
  | 'supplierEmailMissing'
  | 'supplierOrderChannelType'
  | 'supplierPoContacts'
  | 'supplierOrderUrl'
  | 'supplierOrderInstruction'
  | 'supplierInvoiceConfirmSenderEmail'
  | 'hasEmail'
  | 'hasChat'
  | 'hasSms'
> {
  if (!supplier) {
    return {
      supplierOrderChannelSummary: '—',
      supplierContactEmail: 'no email on file',
      supplierEmailMissing: true,
      supplierOrderChannelType: 'direct_instruction',
      supplierPoContacts: [],
      supplierOrderUrl: null,
      supplierOrderInstruction: '',
      supplierInvoiceConfirmSenderEmail: null,
      hasEmail: false,
      hasChat: false,
      hasSms: false,
    };
  }

  const ch = legacyFallbackOrderChannel({
    orderChannelType: supplier.orderChannelType,
    orderChannelPayload: supplier.orderChannelPayload,
    contactEmails: supplier.contactEmails,
    contactName: supplier.contactName,
    link: supplier.link,
    notes: supplier.notes,
  });

  if (ch.type === 'email') {
    const p = ch.payload as EmailOrderChannelPayload;
    const contacts = p.contacts;
    const emails = contacts.map((c) => c.email);
    const emailLine = emails.join(', ');
    const hasEmail = contacts.length > 0;
    const summary = hasEmail
      ? contacts
          .map((c) =>
            [c.name?.trim(), c.email].filter(Boolean).join(' · '),
          )
          .join('; ')
      : 'Email (not set)';
    return {
      supplierOrderChannelSummary: summary,
      supplierContactEmail: emailLine || 'no email on file',
      supplierEmailMissing: !hasEmail,
      supplierOrderChannelType: ch.type as SupplierOrderChannelType,
      supplierPoContacts: contacts,
      supplierOrderUrl: null,
      supplierOrderInstruction: '',
      supplierInvoiceConfirmSenderEmail: null,
      hasEmail,
      hasChat: false,
      hasSms: false,
    };
  }

  if (ch.type === 'order_link') {
    const p = ch.payload as OrderLinkChannelPayload;
    let summary = 'Order link';
    try {
      if (p.orderUrl) summary = new URL(p.orderUrl).hostname;
    } catch {
      /* ignore invalid URL */
    }
    return {
      supplierOrderChannelSummary: summary,
      supplierContactEmail: p.orderUrl?.trim() || '—',
      supplierEmailMissing: false,
      supplierOrderChannelType: ch.type as SupplierOrderChannelType,
      supplierPoContacts: [],
      supplierOrderUrl: p.orderUrl?.trim() ?? null,
      supplierOrderInstruction: p.instruction ?? '',
      supplierInvoiceConfirmSenderEmail: p.invoiceConfirmSenderEmail ?? null,
      hasEmail: false,
      hasChat: false,
      hasSms: false,
    };
  }

  const p = ch.payload as DirectInstructionChannelPayload;
  const instr = p.instruction ?? '';
  return {
    supplierOrderChannelSummary: 'Direct instructions',
    supplierContactEmail: instr
      ? instr.length > 56
        ? `${instr.slice(0, 56)}…`
        : instr
      : '—',
    supplierEmailMissing: false,
    supplierOrderChannelType: ch.type as SupplierOrderChannelType,
    supplierPoContacts: [],
    supplierOrderUrl: null,
    supplierOrderInstruction: instr,
    supplierInvoiceConfirmSenderEmail: null,
    hasEmail: false,
    hasChat: false,
    hasSms: false,
  };
}

export type ShopifyOrderWithCustomer = Prisma.ShopifyOrderGetPayload<{
  include: { customer: true; lineItems: true };
}>;

export type VendorMapping = { vendorName: string; supplierId: string };

// ─── Output: full props for OrderManagementView ───────────────────────────────

export type InboxData = {
  initialStates: Record<SupplierKey, SupplierEntry>;
  viewDataMap: Record<SupplierKey, ViewData>;
  customerGroups: SidebarCustomerGroup[];
  statusTabCounts: Record<StatusTab, number>;
  defaultActiveKey: SupplierKey | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateShort(d: Date | null | undefined): string | null {
  if (!d) return null;
  const s = formatOfficeDateFromDate(d);
  return s || null;
}

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function buildSidebarDates(pos: PrismaPoWithRelations[]): string {
  if (pos.length === 0) return 'Without PO';

  const created = pos
    .map((p) => p.dateCreated)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const expected = pos
    .map((p) => p.expectedDate)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());

  const parts: string[] = [];

  if (created.length === 1) {
    parts.push(`Created ${fmtDateShort(created[0])}`);
  } else if (created.length > 1) {
    const first = fmtDateShort(created[0]);
    const last = fmtDateShort(created[created.length - 1]);
    parts.push(
      first === last ? `Created ${first}` : `Created ${first}–${last}`,
    );
  }

  if (expected.length === 1) {
    parts.push(`Expected ${fmtDateShort(expected[0])}`);
  } else if (expected.length > 1) {
    const first = fmtDateShort(expected[0]);
    const last = fmtDateShort(expected[expected.length - 1]);
    parts.push(
      first === last ? `Expected ${first}` : `Expected ${first}–${last}`,
    );
  }

  return parts.length > 0 ? parts.join(' · ') : 'PO created';
}

type ShippingJson = {
  address1?: string | null;
  city?: string | null;
  province?: string | null;
};

function flattenShippingAddress(json: unknown): string | null {
  if (json == null || typeof json !== 'object') return null;
  const s = json as ShippingJson;
  const parts = [s.address1, s.city, s.province].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ─── Customer identity from ShopifyCustomer ──────────────────────────────────

type CustomerIdentity = {
  customerId: string;
  /** Primary label: override → company → Shopify displayName → email. */
  name: string;
  email: string;
  company: string | null;
  /** Shopify `displayName` only (for subtitle when headline is company). */
  customerDisplayName: string | null;
  displayNameOverride: string | null;
  defaultShippingAddress: CustomerAddress | null;
  defaultBillingAddress: CustomerAddress | null;
  billingSameAsShipping: boolean;
};

function resolveCustomerFields(customer: {
  displayNameOverride?: string | null;
  displayName?: string | null;
  email?: string | null;
  company?: string | null;
}): {
  name: string;
  company: string | null;
  customerDisplayName: string | null;
  displayNameOverride: string | null;
} {
  const override = customer.displayNameOverride?.trim() || null;
  const company = customer.company?.trim() || null;
  const shopifyDisplay = customer.displayName?.trim() || null;
  const email = customer.email?.trim() || null;
  const name = override ?? company ?? shopifyDisplay ?? email ?? 'Unknown';
  return {
    name,
    company,
    customerDisplayName: shopifyDisplay,
    displayNameOverride: override,
  };
}

function extractCustomerAddresses(customer: {
  shippingAddress?: unknown;
  billingAddress?: unknown;
  billingSameAsShipping?: boolean;
}): {
  defaultShippingAddress: CustomerAddress | null;
  defaultBillingAddress: CustomerAddress | null;
  billingSameAsShipping: boolean;
} {
  const ship = customer.shippingAddress as CustomerAddress | null ?? null;
  const bill = customer.billingAddress as CustomerAddress | null ?? null;
  return {
    defaultShippingAddress: ship && ship.address1 ? ship : null,
    defaultBillingAddress: bill && bill.address1 ? bill : null,
    billingSameAsShipping: customer.billingSameAsShipping ?? true,
  };
}

function getPoCustomerIdentity(
  po: PrismaPoWithRelations,
): CustomerIdentity | null {
  for (const so of po.shopifyOrders) {
    if (so.customer) {
      const { name, company, customerDisplayName, displayNameOverride } =
        resolveCustomerFields(so.customer);
      const addr = extractCustomerAddresses(so.customer);
      return {
        customerId: so.customer.id,
        name,
        email: so.customer.email ?? '',
        company,
        customerDisplayName,
        displayNameOverride,
        ...addr,
      };
    }
  }
  for (const so of po.shopifyOrders) {
    if (so.email) {
      return {
        customerId: `email::${so.email}`,
        name: so.email,
        email: so.email,
        company: null,
        customerDisplayName: null,
        displayNameOverride: null,
        defaultShippingAddress: null,
        defaultBillingAddress: null,
        billingSameAsShipping: true,
      };
    }
  }
  return null;
}

function getShopifyOrderCustomerIdentity(
  order: ShopifyOrderWithCustomer,
): CustomerIdentity | null {
  if (order.customer) {
    const { name, company, customerDisplayName, displayNameOverride } =
      resolveCustomerFields(order.customer);
    const addr = extractCustomerAddresses(order.customer);
    return {
      customerId: order.customer.id,
      name,
      email: order.customer.email ?? '',
      company,
      customerDisplayName,
      displayNameOverride,
      ...addr,
    };
  }
  if (order.email) {
    return {
      customerId: `email::${order.email}`,
      name: order.email,
      email: order.email,
      company: null,
      customerDisplayName: null,
      displayNameOverride: null,
      defaultShippingAddress: null,
      defaultBillingAddress: null,
      billingSameAsShipping: true,
    };
  }
  return null;
}

// ─── Vendor → Supplier resolution ────────────────────────────────────────────

const UNASSIGNED_SUPPLIER_ID = '__unassigned__';

function buildVendorLookup(
  vendorMappings: VendorMapping[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of vendorMappings) {
    const k = m.vendorName.trim();
    if (k) map.set(k, m.supplierId);
  }
  return map;
}

function supplierIdForLineItem(
  li: ShopifyOrderWithCustomer['lineItems'][number],
  vendorLookup: Map<string, string>,
): string {
  const vendor = li.vendor?.trim();
  if (!vendor) return UNASSIGNED_SUPPLIER_ID;
  return vendorLookup.get(vendor) ?? UNASSIGNED_SUPPLIER_ID;
}

/** One bucket per supplier that appears on the order (plus unassigned if any line has no / unknown vendor). */
function distinctSupplierIdsForOrder(
  order: ShopifyOrderWithCustomer,
  vendorLookup: Map<string, string>,
): string[] {
  if (order.lineItems.length === 0) return [UNASSIGNED_SUPPLIER_ID];
  const set = new Set<string>();
  for (const li of order.lineItems) {
    set.add(supplierIdForLineItem(li, vendorLookup));
  }
  return [...set];
}

// ─── Shopify order → draft mapping ───────────────────────────────────────────

function shopifyOrderToDraft(
  order: ShopifyOrderWithCustomer,
  supplierBucketId: string,
  vendorLookup: Map<string, string>,
): ShopifyOrderDraft {
  const customer = order.customer;
  const orderEmail = order.email ?? customer?.email ?? null;
  const primaryLabel = customer
    ? (() => {
        const { name } = resolveCustomerFields(customer);
        if (name !== 'Unknown') return name;
        return orderEmail?.trim() ?? null;
      })()
    : orderEmail?.trim() ?? null;

  const rawLines =
    supplierBucketId === UNASSIGNED_SUPPLIER_ID
      ? order.lineItems.filter(
          (li) => supplierIdForLineItem(li, vendorLookup) === UNASSIGNED_SUPPLIER_ID,
        )
      : order.lineItems.filter(
          (li) => supplierIdForLineItem(li, vendorLookup) === supplierBucketId,
        );

  return {
    id: order.id,
    archivedAt: order.archivedAt ? order.archivedAt.toISOString() : null,
    shopifyOrderGid: order.shopifyGid,
    currencyCode: order.currencyCode ?? null,
    orderNumber: order.name ?? order.id,
    customerEmail: customer?.email ?? order.email ?? null,
    customerPhone: customer?.phone ?? null,
    shippingAddressLine: flattenShippingAddress(order.shippingAddress),
    customerDisplayName: primaryLabel,
    orderedAt:
      order.processedAt?.toISOString() ??
      order.shopifyCreatedAt?.toISOString() ??
      null,
    lineItems: sortPrePoLineDraftsByProductTitleAsc(
      rawLines.map((li) => ({
        shopifyLineItemId: li.id,
        shopifyLineItemGid: li.shopifyGid,
        shopifyVariantGid: li.variantGid,
        sku: li.sku,
        imageUrl: li.imageUrl ?? null,
        productTitle: li.title ?? '(untitled)',
        itemPrice: li.price ? String(li.price) : null,
        itemCost: li.unitCost ? String(li.unitCost) : null,
        quantity: li.quantity,
        includeInPo: true,
      })),
    ),
  };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

const UNKNOWN_CUSTOMER_KEY = '__unknown_customer__';

export function buildInboxData(
  purchaseOrders: PrismaPoWithRelations[],
  supplierGroups: PrismaSupplierGroup[],
  unlinkedShopifyOrders: ShopifyOrderWithCustomer[],
  vendorMappings: VendorMapping[],
): InboxData {
  const initialStates: Record<SupplierKey, SupplierEntry> = {};
  const viewDataMap: Record<SupplierKey, ViewData> = {};

  type SupplierMeta = PrismaSupplierGroup['suppliers'][0];
  const supplierById = new Map<string, SupplierMeta>();
  for (const g of supplierGroups) {
    for (const s of g.suppliers) {
      supplierById.set(s.id, s);
    }
  }
  // `Supplier.groupId` may be null: those rows never appear under
  // `supplierGroup.findMany({ include: suppliers })`, but POs still join
  // `purchaseOrder.supplier`. Hydrate the map from loaded POs so the UI does not
  // fall back to "Unknown Supplier".
  for (const po of purchaseOrders) {
    if (po.supplierId && po.supplier && !supplierById.has(po.supplierId)) {
      supplierById.set(po.supplierId, po.supplier);
    }
  }

  const vendorLookup = buildVendorLookup(vendorMappings);

  // ── Group POs by customer → supplier ──

  const byCustSup = new Map<string, Map<string, PrismaPoWithRelations[]>>();
  const custInfoMap = new Map<string, CustomerIdentity>();

  for (const po of purchaseOrders) {
    const identity = getPoCustomerIdentity(po);
    const custKey = identity?.customerId ?? UNKNOWN_CUSTOMER_KEY;

    if (identity && !custInfoMap.has(custKey)) {
      custInfoMap.set(custKey, identity);
    }

    const supKey = po.supplierId;

    if (!byCustSup.has(custKey)) byCustSup.set(custKey, new Map());
    const supMap = byCustSup.get(custKey)!;
    if (!supMap.has(supKey)) supMap.set(supKey, []);
    supMap.get(supKey)!.push(po);
  }

  // ── Group unlinked orders by customer → resolved supplier ──

  const unlinkedByCustSup = new Map<
    string,
    Map<string, ShopifyOrderWithCustomer[]>
  >();

  for (const o of unlinkedShopifyOrders) {
    const identity = getShopifyOrderCustomerIdentity(o);
    const custKey = identity?.customerId ?? UNKNOWN_CUSTOMER_KEY;

    if (identity && !custInfoMap.has(custKey)) {
      custInfoMap.set(custKey, identity);
    }

    const supIds = distinctSupplierIdsForOrder(o, vendorLookup);

    if (!unlinkedByCustSup.has(custKey))
      unlinkedByCustSup.set(custKey, new Map());
    const supMap = unlinkedByCustSup.get(custKey)!;
    for (const supId of supIds) {
      if (!supMap.has(supId)) supMap.set(supId, []);
      supMap.get(supId)!.push(o);
    }
  }

  // ── Collect all customer × supplier pairs ──

  const allCustKeys = new Set([
    ...byCustSup.keys(),
    ...unlinkedByCustSup.keys(),
  ]);

  const statusCounts: Record<StatusTab, number> = {
    inbox: 0,
    without_po: 0,
    po_created: 0,
    fulfilled: 0,
    completed: 0,
    archived: 0,
  };

  const customerGroups: SidebarCustomerGroup[] = [];
  const supLatestOrderDate = new Map<SupplierKey, string | null>();

  for (const custKey of allCustKeys) {
    const custInfo = custInfoMap.get(custKey);
    const poSupMap =
      byCustSup.get(custKey) ?? new Map<string, PrismaPoWithRelations[]>();
    const draftSupMap =
      unlinkedByCustSup.get(custKey) ??
      new Map<string, ShopifyOrderWithCustomer[]>();

    const allSupIds = new Set([...poSupMap.keys(), ...draftSupMap.keys()]);

    const supplierRows: SidebarSupplierRow[] = [];

    for (const supId of allSupIds) {
      const pos = poSupMap.get(supId) ?? [];
      const draftOrders = draftSupMap.get(supId) ?? [];
      const openDraftOrders = draftOrders.filter((o) => o.archivedAt == null);
      const hasPOs = pos.length > 0;
      const hasDrafts = draftOrders.length > 0;
      const hasOpenDrafts = openDraftOrders.length > 0;
      if (!hasPOs && !hasDrafts) continue;

      const supplier =
        supId !== UNASSIGNED_SUPPLIER_ID
          ? supplierById.get(supId)
          : undefined;
      const supplierName =
        supId === UNASSIGNED_SUPPLIER_ID
          ? 'Unassigned'
          : (supplier?.company ?? 'Unknown Supplier');
      const entryKey: SupplierKey = `${custKey}::${supId}`;

      const drafts = draftOrders.map((o) => shopifyOrderToDraft(o, supId, vendorLookup));

      // ── Fulfillment stats (line rows — same as PoTable / mapPrismaPoToBlock panelMeta) ──

      const poBlocks = hasPOs ? pos.map((p) => mapPrismaPoToBlock(p)) : [];
      let fulfillDone = 0;
      let fulfillTotal = 0;
      for (const b of poBlocks) {
        const m = b.panelMeta;
        if (m) {
          fulfillDone += m.fulfillDoneCount;
          fulfillTotal += m.fulfillTotalCount;
        }
      }
      const fulfillPending = fulfillTotal - fulfillDone;

      const allFulfilled =
        poBlocks.length > 0 && poBlocks.every((b) => isOfficePoDeliveryDone(b));
      const allPosCompleted =
        allFulfilled && pos.length > 0 && pos.every((p) => p.completedAt != null);

      const viewSlice: PostViewData = {
        type: 'post',
        purchaseOrders: poBlocks,
        ...(hasDrafts ? { shopifyOrderDrafts: drafts } : {}),
      };
      const rowHasOpenPo = supplierRowHasOpenDeliveryPo(viewSlice);
      const rowHasFulfilledListPo = supplierRowHasFulfilledListPo(viewSlice);

      // ── Archive detection ──
      // Row is archived only when every PO (if any) and every unlinked Shopify order in this slice are archived.

      const allPosArchived = !hasPOs || pos.every((p) => p.archivedAt != null);
      const allDraftsArchived =
        !hasDrafts || draftOrders.every((o) => o.archivedAt != null);
      const isArchived = allPosArchived && allDraftsArchived;

      const archivePurchaseOrderIds = hasPOs ? pos.map((p) => p.id) : [];
      /** Unlinked orders in this row — included even when the row has POs so bulk archive writes DB for every order. */
      const archiveShopifyOrderIds = draftOrders.map((o) => o.id);

      // ── Status counting ──

      if (isArchived) {
        statusCounts.archived++;
      } else {
        if (hasPOs) {
          if (allPosCompleted) {
            statusCounts.completed++;
          } else {
            if (rowHasOpenPo) {
              statusCounts.po_created++;
              statusCounts.inbox++;
            }
            if (rowHasFulfilledListPo) {
              statusCounts.fulfilled++;
            }
          }
        }
        if (hasOpenDrafts) {
          statusCounts.without_po++;
          if (!hasPOs) {
            statusCounts.inbox++;
          }
        }
      }

      // ── Build entry state ──

      const channelFields = buildChannelEntryFields(supplier);
      const anyEmailDeliveryOutstanding =
        hasPOs &&
        pos.some((p) =>
          computeEmailDeliveryOutstanding({
            supplierOrderChannelType: channelFields.supplierOrderChannelType,
            emailSentAt: p.emailSentAt,
            archivedAt: p.archivedAt,
            legacyExternalId: p.legacyExternalId,
          }),
        );
      const custLabel = custInfo?.name ?? 'Unknown';
      const poCount = pos.length;
      const metaParts = [custLabel, supplierName];
      if (poCount > 0) {
        metaParts.push(`${poCount} PO${poCount !== 1 ? 's' : ''}`);
      }
      if (openDraftOrders.length > 0) {
        metaParts.push(
          `${openDraftOrders.length} order${openDraftOrders.length !== 1 ? 's' : ''} without PO`,
        );
      }

      const dates = pos
        .map((p) => p.dateCreated)
        .filter((d): d is Date => d != null);
      const earliestDate =
        dates.length > 0
          ? dates.sort((a, b) => a.getTime() - b.getTime())[0]
          : null;
      const expectedDates = pos
        .map((p) => p.expectedDate)
        .filter((d): d is Date => d != null);
      const latestExpected =
        expectedDates.length > 0
          ? expectedDates.sort((a, b) => b.getTime() - a.getTime())[0]
          : null;

      const sidebarDates = hasPOs
        ? buildSidebarDates(pos)
        : `${openDraftOrders.length} order${openDraftOrders.length !== 1 ? 's' : ''} without PO`;

      // ── Tab-specific date fields ──

      // latestOrderedAt: latest Shopify order date across PO-linked + draft orders
      let latestOrdered: Date | null = null;
      for (const po of pos) {
        for (const so of po.shopifyOrders) {
          const d = so.processedAt ?? so.shopifyCreatedAt;
          if (d && (!latestOrdered || d > latestOrdered)) latestOrdered = d;
        }
      }
      for (const o of draftOrders) {
        const d = o.processedAt ?? o.shopifyCreatedAt;
        if (d && (!latestOrdered || d > latestOrdered)) latestOrdered = d;
      }

      // expectedDates: all unique expected dates from POs (ISO strings)
      const allExpectedDates = pos
        .map((p) => isoDate(p.expectedDate))
        .filter((d): d is string => d != null);
      const uniqueExpectedDates = [...new Set(allExpectedDates)].sort();

      // fulfilledAt: PO receivedAt, or latest updatedAt among FULFILLED ShopifyOrders
      let fulfilledDate: Date | null = null;
      for (const po of pos) {
        if (po.receivedAt && (!fulfilledDate || po.receivedAt > fulfilledDate)) {
          fulfilledDate = po.receivedAt;
        }
      }
      if (!fulfilledDate) {
        for (const po of pos) {
          for (const so of po.shopifyOrders) {
            if (so.displayFulfillmentStatus === 'FULFILLED' && so.updatedAt) {
              if (!fulfilledDate || so.updatedAt > fulfilledDate) fulfilledDate = so.updatedAt;
            }
          }
        }
      }

      // completedAt: latest PO completedAt
      let completedDate: Date | null = null;
      for (const po of pos) {
        if (po.completedAt && (!completedDate || po.completedAt > completedDate)) {
          completedDate = po.completedAt;
        }
      }

      initialStates[entryKey] = {
        meta: metaParts.join(' · '),
        poCreated: hasPOs,
        referenceKey: hasPOs
          ? pos.map((p) => p.poNumber).join('+')
          : `${custLabel}–without-po–${supplierName}`,
        dateCreated: isoDate(earliestDate),
        expectedDate: isoDate(latestExpected),
        supplierCompany: supplierName,
        ...channelFields,
        fulfillDoneCount: fulfillDone,
        fulfillPendingCount: fulfillPending,
        fulfillTotalCount: fulfillTotal,
        emailSent:
          channelFields.supplierOrderChannelType === 'email' && hasPOs
            ? !anyEmailDeliveryOutstanding
            : false,
        sidebarDates,
        withoutPoDraftCount: openDraftOrders.length,
        allFulfilled,
        allCompleted: allPosCompleted,
        latestOrderedAt: latestOrdered ? toVancouverYmd(latestOrdered) : null,
        expectedDates: uniqueExpectedDates,
        fulfilledAt: fulfilledDate ? fulfilledDate.toISOString().slice(0, 10) : null,
        completedAt: completedDate ? completedDate.toISOString().slice(0, 10) : null,
        isArchived,
        archivePurchaseOrderIds,
        archiveShopifyOrderIds,
      };

      // ── Build view data ──

      if (hasPOs) {
        const blocks = poBlocks;
        const isMulti = blocks.length > 1;
        if (isMulti) {
          for (const block of blocks) {
            block.subtreeRowLabel = `PO #${block.poNumber}${block.isAuto ? '' : ' — custom'}`;
          }
        }

        viewDataMap[entryKey] = {
          type: 'post',
          purchaseOrders: blocks,
          shopifyOrderDrafts: hasDrafts ? drafts : undefined,
          ...(isMulti && {
            subtreeParentLabel: `${supplierName} · ${blocks.length} POs`,
            multiPoSubtree: true,
          }),
        } satisfies PostViewData;
      } else {
        viewDataMap[entryKey] = { type: 'pre', shopifyOrderDrafts: drafts };
      }

      // ── Sidebar row ──

      const poPills: PoPill[] | undefined =
        pos.length > 1
          ? pos.map((p) => ({ label: `PO #${p.poNumber}`, id: p.id }))
          : undefined;

      supplierRows.push({
        key: entryKey,
        name: supplierName,
        poPills,
        withoutPoCount:
          openDraftOrders.length > 0 ? openDraftOrders.length : undefined,
      });

      // Track latest order date per supplier for sorting
      let supLatest: Date | null = null;
      for (const po of pos) {
        for (const so of po.shopifyOrders) {
          const d = so.processedAt ?? so.shopifyCreatedAt;
          if (d && (!supLatest || d > supLatest)) supLatest = d;
        }
      }
      for (const o of draftOrders) {
        const d = o.processedAt ?? o.shopifyCreatedAt;
        if (d && (!supLatest || d > supLatest)) supLatest = d;
      }
      supLatestOrderDate.set(entryKey, supLatest ? supLatest.toISOString() : null);
    }

    if (supplierRows.length > 0) {
      supplierRows.sort((a, b) => {
        const da = supLatestOrderDate.get(a.key) ?? '';
        const db = supLatestOrderDate.get(b.key) ?? '';
        if (da > db) return -1;
        if (da < db) return 1;
        return 0;
      });

      const hasWithoutPo = supplierRows.some((r) => (r.withoutPoCount ?? 0) > 0);

      // Find the most recent order date across all POs and drafts for this customer
      const poGroup = byCustSup.get(custKey);
      const draftGroup = unlinkedByCustSup.get(custKey);
      let latestDate: Date | null = null;

      if (poGroup) {
        for (const pos of poGroup.values()) {
          for (const po of pos) {
            for (const so of po.shopifyOrders) {
              const d = so.processedAt ?? so.shopifyCreatedAt;
              if (d && (!latestDate || d > latestDate)) latestDate = d;
            }
          }
        }
      }
      if (draftGroup) {
        for (const orders of draftGroup.values()) {
          for (const o of orders) {
            const d = o.processedAt ?? o.shopifyCreatedAt;
            if (d && (!latestDate || d > latestDate)) latestDate = d;
          }
        }
      }

      customerGroups.push({
        id: custKey,
        name: custInfo?.name ?? '—',
        email: custInfo?.email ?? '',
        company: custInfo?.company ?? null,
        customerDisplayName: custInfo?.customerDisplayName ?? null,
        displayNameOverride: custInfo?.displayNameOverride ?? null,
        suppliers: supplierRows,
        hasWithoutPo,
        latestOrderDate: latestDate ? latestDate.toISOString() : null,
        defaultShippingAddress: custInfo?.defaultShippingAddress ?? null,
        defaultBillingAddress: custInfo?.defaultBillingAddress ?? null,
        billingSameAsShipping: custInfo?.billingSameAsShipping ?? true,
      });
    }
  }

  // Sort customer groups: most recent order first, unknown customers last
  customerGroups.sort((a, b) => {
    const aUnknown = a.id === UNKNOWN_CUSTOMER_KEY;
    const bUnknown = b.id === UNKNOWN_CUSTOMER_KEY;
    if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
    const da = a.latestOrderDate ?? '';
    const db = b.latestOrderDate ?? '';
    if (da > db) return -1;
    if (da < db) return 1;
    return 0;
  });

  const allKeys = Object.keys(initialStates);
  const defaultActiveKey = allKeys[0] ?? null;

  console.log(
    `[buildInboxData] ${purchaseOrders.length} POs, ${unlinkedShopifyOrders.length} unlinked orders → ${customerGroups.length} customer groups, ${allKeys.length} entries`,
    statusCounts,
  );

  return {
    initialStates,
    viewDataMap,
    customerGroups,
    statusTabCounts: statusCounts,
    defaultActiveKey,
  };
}

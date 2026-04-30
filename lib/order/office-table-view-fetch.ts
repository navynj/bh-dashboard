import { prisma } from '@/lib/core/prisma';
import { OFFICE_TABLE_VIEW_FETCH_LIMIT } from '@/features/order/office/constants/office-table-view';
import { shopifyMyshopifyAdminOrderUrl } from '@/features/order/office/utils/shopify-admin-order-url';
import type {
  OfficeTableViewPoRow,
  OfficeTableViewShopifyRow,
} from '@/features/order/office/types/office-table-view';
import { computeEmailDeliveryOutstanding } from '@/features/order/office/utils/po-email-delivery-policy';
import type { PurchaseOrderStatus } from '@/features/order/office/types/purchase-order';
import { expectedPoEmailRecipientCount } from '@/lib/order/expected-po-email-recipient-count';
import { legacyFallbackOrderChannel } from '@/lib/order/supplier-order-channel';

type ShopifyCustomerForTable = {
  displayName: string | null;
  displayNameOverride: string | null;
  company: string | null;
  email: string | null;
} | null;

export function customerLabelForOfficeTable(c: ShopifyCustomerForTable): string {
  if (!c) return '—';
  const name =
    (c.displayNameOverride?.trim() || c.displayName?.trim() || '') || '';
  const company = c.company?.trim() || '';
  if (company && name && company !== name) return `${company} · ${name}`;
  if (company) return company;
  if (name) return name;
  return c.email?.trim() || '—';
}

export function mapShopifyOrderToTableRow(o: {
  id: string;
  shopifyGid: string;
  name: string;
  orderNumber: number;
  shopifyCreatedAt: Date | null;
  displayFulfillmentStatus: string | null;
  displayFinancialStatus: string | null;
  archivedAt: Date | null;
  customerNote?: string | null;
  customer: ShopifyCustomerForTable;
  purchaseOrders: { id: string; poNumber: string }[];
  _count: { lineItems: number };
}): OfficeTableViewShopifyRow {
  const memo = o.customerNote?.trim() ?? '';
  return {
    id: o.id,
    orderLabel: o.name,
    orderNumber: o.orderNumber,
    shopifyCreatedAt: o.shopifyCreatedAt?.toISOString() ?? null,
    displayFulfillmentStatus: o.displayFulfillmentStatus,
    displayFinancialStatus: o.displayFinancialStatus,
    archived: o.archivedAt != null,
    customerLabel: customerLabelForOfficeTable(o.customer),
    shopifyAdminOrderUrl: shopifyMyshopifyAdminOrderUrl(o.shopifyGid),
    lineItemCount: o._count.lineItems,
    linkedPurchaseOrders: o.purchaseOrders.map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
    })),
    orderMemo: memo.length > 0 ? memo : null,
  };
}

function formatPoCreatedByLabel(
  user: { name: string | null; email: string | null } | null,
): string {
  if (!user) return '—';
  const name = user.name?.trim() ?? '';
  const email = user.email?.trim() ?? '';
  if (name && email) return `${name} (${email})`;
  return name || email || '—';
}

export function mapPurchaseOrderToTableRow(po: {
  id: string;
  poNumber: string;
  status: string;
  createdAt: Date;
  expectedDate: Date | null;
  archivedAt: Date | null;
  legacyExternalId: number | null;
  emailSentAt: Date | null;
  emailDeliveryWaivedAt: Date | null;
  emailReplyReceivedAt: Date | null;
  supplier: {
    company: string;
    orderChannelType: string;
    orderChannelPayload: unknown;
    contactEmails: string[];
    contactName: string | null;
    link: string | null;
    notes: string | null;
  };
  createdBy: { name: string | null; email: string | null } | null;
  _count: { lineItems: number; shopifyOrders: number; emailDeliveries: number };
}): OfficeTableViewPoRow {
  const resolvedChannel = legacyFallbackOrderChannel({
    orderChannelType: po.supplier.orderChannelType,
    orderChannelPayload: po.supplier.orderChannelPayload,
    contactEmails: po.supplier.contactEmails,
    contactName: po.supplier.contactName,
    link: po.supplier.link,
    notes: po.supplier.notes,
  });
  const poEmailTracked =
    resolvedChannel.type === 'email' && po.legacyExternalId == null;
  const expectedPoEmailRecipients = poEmailTracked
    ? expectedPoEmailRecipientCount(po.supplier)
    : 0;
  const emailDeliveryOutstanding = computeEmailDeliveryOutstanding({
    supplierOrderChannelType: resolvedChannel.type,
    emailSentAt: po.emailSentAt,
    archivedAt: po.archivedAt,
    legacyExternalId: po.legacyExternalId,
    emailDeliveryWaivedAt: po.emailDeliveryWaivedAt,
    purchaseOrderStatus: po.status as PurchaseOrderStatus,
  });

  return {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    supplierCompany: po.supplier.company,
    createdByLabel: formatPoCreatedByLabel(po.createdBy),
    poEmailTracked,
    expectedPoEmailRecipients,
    emailDeliveryOutstanding,
    createdAt: po.createdAt.toISOString(),
    expectedDate: po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : null,
    emailSentAt: po.emailSentAt ? po.emailSentAt.toISOString() : null,
    emailDeliveryWaivedAt: po.emailDeliveryWaivedAt
      ? po.emailDeliveryWaivedAt.toISOString()
      : null,
    emailDeliveryCount: po._count.emailDeliveries,
    emailReplyReceivedAt: po.emailReplyReceivedAt
      ? po.emailReplyReceivedAt.toISOString()
      : null,
    archived: po.archivedAt != null,
    lineItemCount: po._count.lineItems,
    shopifyOrderCount: po._count.shopifyOrders,
  };
}

export const shopifySelect = {
  id: true,
  shopifyGid: true,
  name: true,
  orderNumber: true,
  shopifyCreatedAt: true,
  displayFulfillmentStatus: true,
  displayFinancialStatus: true,
  archivedAt: true,
  customerNote: true,
  customer: {
    select: {
      displayName: true,
      displayNameOverride: true,
      company: true,
      email: true,
    },
  },
  purchaseOrders: {
    select: { id: true, poNumber: true },
    orderBy: { createdAt: 'desc' },
  },
  _count: { select: { lineItems: true } },
} as const;

export const poSelect = {
  id: true,
  poNumber: true,
  status: true,
  createdAt: true,
  expectedDate: true,
  archivedAt: true,
  legacyExternalId: true,
  emailSentAt: true,
  emailDeliveryWaivedAt: true,
  emailReplyReceivedAt: true,
  supplier: {
    select: {
      company: true,
      orderChannelType: true,
      orderChannelPayload: true,
      contactEmails: true,
      contactName: true,
      link: true,
      notes: true,
    },
  },
  createdBy: { select: { name: true, email: true } },
  _count: { select: { lineItems: true, shopifyOrders: true, emailDeliveries: true } },
} as const;

export async function fetchShopifyOrdersForOfficeTableView(
  skip: number,
  take: number,
): Promise<OfficeTableViewShopifyRow[]> {
  const raw = await prisma.shopifyOrder.findMany({
    orderBy: [{ shopifyCreatedAt: 'desc' }, { createdAt: 'desc' }],
    skip,
    take,
    select: shopifySelect,
  });
  return raw.map(mapShopifyOrderToTableRow);
}

export async function fetchPurchaseOrdersForOfficeTableView(
  skip: number,
  take: number,
): Promise<OfficeTableViewPoRow[]> {
  const raw = await prisma.purchaseOrder.findMany({
    orderBy: [{ createdAt: 'desc' }, { dateCreated: 'desc' }],
    skip,
    take,
    select: poSelect,
  });
  return raw.map(mapPurchaseOrderToTableRow);
}

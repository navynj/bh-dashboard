import { prisma } from '@/lib/core/prisma';
import { OFFICE_TABLE_VIEW_FETCH_LIMIT } from '@/features/order/office/constants/office-table-view';
import { shopifyMyshopifyAdminOrderUrl } from '@/features/order/office/utils/shopify-admin-order-url';
import type {
  OfficeTableViewPoRow,
  OfficeTableViewShopifyRow,
} from '@/features/order/office/types/office-table-view';

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
  customer: ShopifyCustomerForTable;
  purchaseOrders: { id: string; poNumber: string }[];
  _count: { lineItems: number };
}): OfficeTableViewShopifyRow {
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
  };
}

export function mapPurchaseOrderToTableRow(po: {
  id: string;
  poNumber: string;
  status: string;
  createdAt: Date;
  expectedDate: Date | null;
  archivedAt: Date | null;
  supplier: { company: string };
  _count: { lineItems: number; shopifyOrders: number };
}): OfficeTableViewPoRow {
  return {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    supplierCompany: po.supplier.company,
    createdAt: po.createdAt.toISOString(),
    expectedDate: po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : null,
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
  supplier: { select: { company: true } },
  _count: { select: { lineItems: true, shopifyOrders: true } },
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

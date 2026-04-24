import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/prisma';
import {
  mapPurchaseOrderToTableRow,
  mapShopifyOrderToTableRow,
  poSelect,
  shopifySelect,
} from '@/lib/order/office-table-view-fetch';
import type {
  OfficeTableViewPoRow,
  OfficeTableViewShopifyRow,
} from '@/features/order/office/types/office-table-view';

export type OfficeTableListQuery = {
  q?: string;
  customerId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** PO list only: which date column `dateFrom`/`dateTo` apply to. */
  poDateField?: 'created' | 'expected';
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseYmdStartUtc(ymd: string): Date | null {
  if (!YMD.test(ymd)) return null;
  return new Date(`${ymd}T00:00:00.000Z`);
}

function parseYmdEndUtc(ymd: string): Date | null {
  if (!YMD.test(ymd)) return null;
  return new Date(`${ymd}T23:59:59.999Z`);
}

function clampQ(q: string | undefined): string | undefined {
  const t = q?.trim();
  if (!t) return undefined;
  return t.slice(0, 160);
}

async function buildShopifyWhere(
  query: OfficeTableListQuery,
): Promise<Prisma.ShopifyOrderWhereInput> {
  const and: Prisma.ShopifyOrderWhereInput[] = [];

  const q = clampQ(query.q);
  if (q) {
    const or: Prisma.ShopifyOrderWhereInput[] = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      {
        purchaseOrders: {
          some: { poNumber: { contains: q, mode: 'insensitive' } },
        },
      },
      {
        customer: {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { displayNameOverride: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      {
        lineItems: {
          some: {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { vendor: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
    const n = parseInt(q.replace(/^#/, '').trim(), 10);
    if (!Number.isNaN(n) && String(n) === q.replace(/^#/, '').trim()) {
      or.push({ orderNumber: n });
    }
    and.push({ OR: or });
  }

  if (query.customerId) {
    and.push({ customerId: query.customerId });
  }

  if (query.supplierId) {
    const mappings = await prisma.shopifyVendorMapping.findMany({
      where: { supplierId: query.supplierId },
      select: { vendorName: true },
    });
    const vendorNames = mappings.map((m) => m.vendorName).filter(Boolean);
    const supplierOr: Prisma.ShopifyOrderWhereInput[] = [
      { purchaseOrders: { some: { supplierId: query.supplierId } } },
    ];
    if (vendorNames.length > 0) {
      supplierOr.push({
        lineItems: { some: { vendor: { in: vendorNames } } },
      });
    }
    and.push({ OR: supplierOr });
  }

  const from = query.dateFrom ? parseYmdStartUtc(query.dateFrom) : null;
  const to = query.dateTo ? parseYmdEndUtc(query.dateTo) : null;
  if (from || to) {
    const range: Prisma.DateTimeNullableFilter = {};
    if (from) range.gte = from;
    if (to) range.lte = to;
    and.push({ shopifyCreatedAt: range });
  }

  return and.length > 0 ? { AND: and } : {};
}

function buildPoWhere(query: OfficeTableListQuery): Prisma.PurchaseOrderWhereInput {
  const and: Prisma.PurchaseOrderWhereInput[] = [];

  const q = clampQ(query.q);
  if (q) {
    const or: Prisma.PurchaseOrderWhereInput[] = [
      { poNumber: { contains: q, mode: 'insensitive' } },
      { supplier: { company: { contains: q, mode: 'insensitive' } } },
      {
        lineItems: {
          some: {
            OR: [
              { productTitle: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { supplierRef: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        shopifyOrders: {
          some: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
    and.push({ OR: or });
  }

  if (query.customerId) {
    and.push({
      shopifyOrders: { some: { customerId: query.customerId } },
    });
  }

  if (query.supplierId) {
    and.push({ supplierId: query.supplierId });
  }

  const from = query.dateFrom ? parseYmdStartUtc(query.dateFrom) : null;
  const to = query.dateTo ? parseYmdEndUtc(query.dateTo) : null;
  if (from || to) {
    if (query.poDateField === 'expected') {
      const range: Prisma.DateTimeNullableFilter = {};
      if (from) range.gte = from;
      if (to) range.lte = to;
      and.push({ expectedDate: range });
    } else {
      const range: Prisma.DateTimeFilter = {};
      if (from) range.gte = from;
      if (to) range.lte = to;
      and.push({ createdAt: range });
    }
  }

  return and.length > 0 ? { AND: and } : {};
}

export function parseOfficeTableListQuery(
  sp: URLSearchParams,
  kind: 'shopify' | 'po',
): OfficeTableListQuery {
  const q = sp.get('q') ?? undefined;
  const customerId = sp.get('customerId')?.trim() || undefined;
  const supplierId = sp.get('supplierId')?.trim() || undefined;
  const dateFrom = sp.get('dateFrom')?.trim() || undefined;
  const dateTo = sp.get('dateTo')?.trim() || undefined;
  const pdf = sp.get('poDateField');
  const poDateField =
    pdf === 'expected' || pdf === 'created'
      ? pdf
      : ('created' as const);
  return {
    q: q || undefined,
    customerId: customerId || undefined,
    supplierId: supplierId || undefined,
    dateFrom: dateFrom && YMD.test(dateFrom) ? dateFrom : undefined,
    dateTo: dateTo && YMD.test(dateTo) ? dateTo : undefined,
    ...(kind === 'po' ? { poDateField } : {}),
  };
}

export async function queryShopifyTableRows(
  query: OfficeTableListQuery,
  skip: number,
  take: number,
): Promise<{ rows: OfficeTableViewShopifyRow[]; total: number }> {
  const where = await buildShopifyWhere(query);
  const [raw, total] = await Promise.all([
    prisma.shopifyOrder.findMany({
      where,
      orderBy: [{ shopifyCreatedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
      select: shopifySelect,
    }),
    prisma.shopifyOrder.count({ where }),
  ]);
  return { rows: raw.map(mapShopifyOrderToTableRow), total };
}

export async function queryPoTableRows(
  query: OfficeTableListQuery,
  skip: number,
  take: number,
): Promise<{ rows: OfficeTableViewPoRow[]; total: number }> {
  const where = buildPoWhere(query);
  const [raw, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { dateCreated: 'desc' }],
      skip,
      take,
      select: poSelect,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return { rows: raw.map(mapPurchaseOrderToTableRow), total };
}

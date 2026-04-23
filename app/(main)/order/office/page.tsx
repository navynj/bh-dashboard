import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { Suspense } from 'react';
import { OrderManagementView } from '@/features/order/office/views/OrderManagementView';
import { buildInboxData } from '@/features/order/office/mappers/build-inbox-data';
import { buildWeekPeriods } from '@/features/order/office/mappers/periods';
import { isShopifyAdminEnvConfigured } from '@/lib/shopify/env';
import type {
  PrismaPoWithRelations,
  PrismaPoSlimWithRelations,
} from '@/features/order/office/mappers/map-purchase-order';
import { executeShopifySync } from '@/lib/shopify/sync/run-shopify-sync';
import OfficeOrderLoading from './loading';

export const dynamic = 'force-dynamic';

const UNLINKED_ORDERS_DAYS = 90;

export default async function OfficeOrderInboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');

  // Run Shopify sync AFTER the response is sent so it never blocks page render.
  if (getOfficeOrAdmin(session.user.role) && isShopifyAdminEnvConfigured()) {
    after(async () => {
      const tSync = Date.now();
      try {
        const syncResult = await executeShopifySync('incremental');
        console.log(
          `[OfficeInbox] background sync ${Date.now() - tSync}ms — orders synced: ${syncResult.synced}/${syncResult.fetched}, customers: ${syncResult.customersSynced}`,
        );
      } catch (err) {
        console.error('[OfficeInbox] background sync failed:', err);
      }
    });
  }

  // Stream the page: shell renders immediately, data loads in background.
  return (
    <Suspense fallback={<OfficeOrderLoading />}>
      <OfficeInboxContent />
    </Suspense>
  );
}

async function OfficeInboxContent() {
  const t0 = Date.now();

  const unlinkedCutoff = new Date();
  unlinkedCutoff.setDate(unlinkedCutoff.getDate() - UNLINKED_ORDERS_DAYS);

  const [
    rawActivePOs,
    rawArchivedPOs,
    supplierGroups,
    unlinkedShopifyOrders,
    vendorMappings,
    rawLineCounts,
  ] = await Promise.all([
    // Active POs — skip lineItems entirely; use _count for total, separate query for done counts
    prisma.purchaseOrder.findMany({
      where: { archivedAt: null },
      orderBy: [{ dateCreated: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { lineItems: true } },
        shopifyOrders: { include: { customer: true } },
        supplier: true,
        emailDeliveries: { orderBy: { sentAt: 'desc' } },
      },
    }),
    // Archived POs — no shopifyOrderLineItem, no emailDeliveries (not needed for sidebar)
    prisma.purchaseOrder.findMany({
      where: { archivedAt: { not: null } },
      orderBy: [{ dateCreated: 'desc' }, { createdAt: 'desc' }],
      include: {
        lineItems: { orderBy: { sequence: 'asc' } },
        shopifyOrders: { include: { customer: true } },
        supplier: true,
      },
      take: 100,
    }),
    prisma.supplierGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        suppliers: { orderBy: { company: 'asc' } },
      },
    }),
    // Unlinked orders — filter VOIDED in DB (null-safe OR clause preserves orders with no status)
    prisma.shopifyOrder.findMany({
      where: {
        purchaseOrders: { none: {} },
        displayFulfillmentStatus: { not: 'FULFILLED' },
        shopifyCreatedAt: { gte: unlinkedCutoff },
        OR: [
          { displayFinancialStatus: null },
          { displayFinancialStatus: { not: 'VOIDED' } },
        ],
      },
      orderBy: { shopifyCreatedAt: 'desc' },
      include: {
        customer: true,
        lineItems: true,
      },
    }),
    prisma.shopifyVendorMapping.findMany({
      select: { vendorName: true, supplierId: true },
    }),
    // Minimal line-item data for fulfillment counts — 3 columns only, no joins
    prisma.purchaseOrderLineItem.findMany({
      where: { purchaseOrder: { archivedAt: null } },
      select: { purchaseOrderId: true, quantity: true, quantityReceived: true },
    }),
  ]);

  // Build per-PO fulfillment counts from the minimal line query
  const lineCountsByPoId = new Map<string, { total: number; done: number }>();
  for (const li of rawLineCounts) {
    const cur = lineCountsByPoId.get(li.purchaseOrderId) ?? { total: 0, done: 0 };
    cur.total++;
    if (li.quantity <= 0 || li.quantityReceived >= li.quantity) cur.done++;
    lineCountsByPoId.set(li.purchaseOrderId, cur);
  }

  const activePurchaseOrders = rawActivePOs as unknown as PrismaPoSlimWithRelations[];

  const archivedPurchaseOrders = rawArchivedPOs.map((po) => ({
    ...po,
    lineItems: po.lineItems.map((li) => ({ ...li, shopifyOrderLineItem: null })),
    emailDeliveries: [],
  })) as unknown as PrismaPoWithRelations[];

  console.log(
    `[OfficeInbox] DB loaded in ${Date.now() - t0}ms — ${activePurchaseOrders.length} active + ${archivedPurchaseOrders.length} archived POs, ${unlinkedShopifyOrders.length} unlinked orders`,
  );

  const inbox = buildInboxData(
    activePurchaseOrders,
    archivedPurchaseOrders,
    supplierGroups,
    unlinkedShopifyOrders,
    vendorMappings,
    lineCountsByPoId,
  );

  const periods = buildWeekPeriods();

  return (
    <OrderManagementView
      initialStates={inbox.initialStates}
      viewDataMap={inbox.viewDataMap}
      customerGroups={inbox.customerGroups}
      supplierGroupFilterOptions={inbox.supplierGroupFilterOptions}
      statusTabCounts={inbox.statusTabCounts}
      defaultActiveKey={inbox.defaultActiveKey}
      periods={periods}
    />
  );
}

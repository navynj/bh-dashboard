import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { redirect } from 'next/navigation';
import { OrderManagementView } from '@/features/order/office/views/OrderManagementView';
import { buildInboxData } from '@/features/order/office/mappers/build-inbox-data';
import { buildWeekPeriods } from '@/features/order/office/mappers/periods';
import { isShopifyAdminEnvConfigured } from '@/lib/shopify/env';
import { executeShopifySync } from '@/lib/shopify/sync/run-shopify-sync';

export const dynamic = 'force-dynamic';

const UNLINKED_ORDERS_DAYS = 90;

export default async function OfficeOrderInboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');

  if (getOfficeOrAdmin(session.user.role) && isShopifyAdminEnvConfigured()) {
    const tSync = Date.now();
    try {
      const syncResult = await executeShopifySync('incremental');
      console.log(
        `[OfficeInbox] incremental sync ${Date.now() - tSync}ms — orders synced: ${syncResult.synced}/${syncResult.fetched}, customers: ${syncResult.customersSynced}`,
      );
    } catch (err) {
      console.error('[OfficeInbox] incremental sync failed:', err);
    }
  }

  const t0 = Date.now();

  const unlinkedCutoff = new Date();
  unlinkedCutoff.setDate(unlinkedCutoff.getDate() - UNLINKED_ORDERS_DAYS);

  const [
    activePurchaseOrders,
    archivedPurchaseOrders,
    supplierGroups,
    unlinkedShopifyOrders,
    vendorMappings,
  ] = await Promise.all([
    // Active POs — full includes
    prisma.purchaseOrder.findMany({
      where: { archivedAt: null },
      orderBy: [{ dateCreated: 'desc' }, { createdAt: 'desc' }],
      include: {
        lineItems: {
          orderBy: { sequence: 'asc' },
          include: { shopifyOrderLineItem: true },
        },
        shopifyOrders: { include: { customer: true } },
        supplier: true,
      },
    }),
    // Archived POs — minimal includes (enough for sidebar + counts)
    prisma.purchaseOrder.findMany({
      where: { archivedAt: { not: null } },
      orderBy: [{ dateCreated: 'desc' }, { createdAt: 'desc' }],
      include: {
        lineItems: {
          orderBy: { sequence: 'asc' },
          include: { shopifyOrderLineItem: true },
        },
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
    // Unlinked orders — only recent (last N days), unfulfilled
    prisma.shopifyOrder.findMany({
      where: {
        purchaseOrders: { none: {} },
        displayFulfillmentStatus: { not: 'FULFILLED' },
        shopifyCreatedAt: { gte: unlinkedCutoff },
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
  ]);

  const purchaseOrders = [...activePurchaseOrders, ...archivedPurchaseOrders];

  console.log(
    `[OfficeInbox] DB loaded in ${Date.now() - t0}ms — ${activePurchaseOrders.length} active + ${archivedPurchaseOrders.length} archived POs, ${unlinkedShopifyOrders.length} unlinked orders`,
  );

  const inbox = buildInboxData(
    purchaseOrders,
    supplierGroups,
    unlinkedShopifyOrders,
    vendorMappings,
  );

  const periods = buildWeekPeriods();

  return (
    <OrderManagementView
      initialStates={inbox.initialStates}
      viewDataMap={inbox.viewDataMap}
      customerGroups={inbox.customerGroups}
      statusTabCounts={inbox.statusTabCounts}
      defaultActiveKey={inbox.defaultActiveKey}
      periods={periods}
    />
  );
}

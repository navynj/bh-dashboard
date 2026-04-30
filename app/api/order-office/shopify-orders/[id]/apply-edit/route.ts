import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, shopifyOrderApplyEditBodySchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { resyncPurchaseOrderLineItemsFromShopify } from '@/lib/order/resync-po-from-shopify';
import { fetchShopifyOrderNodeByGid } from '@/lib/shopify/fetchOrders';
import { getShopifyAdminEnv } from '@/lib/shopify/env';
import {
  applyOrderEditAndCommit,
  applyVariantCatalogPriceUpdates,
  type OrderEditOperation,
} from '@/lib/shopify/orderEdit';
import { syncOneOrder } from '@/lib/shopify/sync/upsert-order';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const { id: localOrderId } = await context.params;
    const parsed = await parseBody(request, shopifyOrderApplyEditBodySchema);
    if ('error' in parsed) return parsed.error;
    const { data } = parsed;

    const order = await prisma.shopifyOrder.findUnique({
      where: { id: localOrderId },
      select: { id: true, shopifyGid: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Shopify order not found' }, { status: 404 });
    }

    const creds = getShopifyAdminEnv();

    await applyOrderEditAndCommit(
      creds,
      order.shopifyGid,
      data.operations as OrderEditOperation[],
      { notifyCustomer: false },
    );

    const variantCatalogUpdates = data.variantCatalogUpdates;
    const hasVariantUpdates = Boolean(variantCatalogUpdates?.length);
    const syncOutcome = (async (): Promise<boolean> => {
      const node = await fetchShopifyOrderNodeByGid(creds, order.shopifyGid, {
        lineItems: 'sync',
      });
      if (!node) return false;
      await syncOneOrder(node);
      return true;
    })();

    const [, ok] = await Promise.all([
      hasVariantUpdates && variantCatalogUpdates
        ? applyVariantCatalogPriceUpdates(creds, variantCatalogUpdates)
        : Promise.resolve(),
      syncOutcome,
    ]);

    if (!ok) {
      return NextResponse.json(
        { error: 'Could not reload order from Shopify after edit.' },
        { status: 502 },
      );
    }

    if (data.purchaseOrderId && !data.deferPurchaseOrderResync) {
      await resyncPurchaseOrderLineItemsFromShopify({
        purchaseOrderId: data.purchaseOrderId,
        appendFromShopifyOrderId: data.appendLinesFromShopifyOrderLocalId ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/order-office/shopify-orders/[id]/apply-edit');
  }
}

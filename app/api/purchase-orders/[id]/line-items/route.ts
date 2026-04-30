import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, purchaseOrderLineItemsNotePatchSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import {
  mapPrismaPayloadToPoLineItemViews,
  mapPrismaPoToBlock,
  prismaPoCreatedByInclude,
} from '@/features/order/office/mappers/map-purchase-order';

type RouteContext = { params: Promise<{ id: string }> };

/** Slim read for office lazy line table — avoids supplier, customers, emailDeliveries. */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        completedAt: true,
        lineItems: {
          orderBy: { sequence: 'asc' },
          include: { shopifyOrderLineItem: true },
        },
        shopifyOrders: {
          select: {
            id: true,
            name: true,
            displayFulfillmentStatus: true,
          },
        },
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 },
      );
    }

    const unlinkedVariantGids = po.lineItems
      .filter((li) => !li.shopifyOrderLineItem && li.shopifyVariantGid)
      .map((li) => li.shopifyVariantGid!);

    const variantImageFallback = new Map<string, string | null>();
    if (unlinkedVariantGids.length > 0) {
      const rows = await prisma.shopifyOrderLineItem.findMany({
        where: { variantGid: { in: unlinkedVariantGids }, imageUrl: { not: null } },
        select: { variantGid: true, imageUrl: true },
        distinct: ['variantGid'],
      });
      for (const r of rows) {
        if (r.variantGid) variantImageFallback.set(r.variantGid, r.imageUrl);
      }
    }

    const lineItems = mapPrismaPayloadToPoLineItemViews(
      {
        status: po.status,
        completedAt: po.completedAt,
        lineItems: po.lineItems,
        shopifyOrders: po.shopifyOrders,
      },
      variantImageFallback,
    );

    return NextResponse.json({ ok: true, lineItems });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/purchase-orders/[id]/line-items');
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const { id: purchaseOrderId } = await context.params;
    const parsed = await parseBody(request, purchaseOrderLineItemsNotePatchSchema);
    if ('error' in parsed) return parsed.error;
    const { data } = parsed;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { id: true },
    });
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const ids = data.items.map((i) => i.id);
    const existing = await prisma.purchaseOrderLineItem.findMany({
      where: { purchaseOrderId, id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      return NextResponse.json(
        { error: 'One or more line items do not belong to this PO.' },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      data.items.map((it) =>
        prisma.purchaseOrderLineItem.update({
          where: { id: it.id },
          data: {
            note: it.note?.trim() ? it.note.trim() : null,
          },
        }),
      ),
    );

    const full = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: {
        lineItems: {
          orderBy: { sequence: 'asc' },
          include: { shopifyOrderLineItem: true },
        },
        shopifyOrders: { include: { customer: true } },
        supplier: true,
        emailDeliveries: { orderBy: { sentAt: 'desc' } },
        createdBy: prismaPoCreatedByInclude,
        deliveryLocationPreset: {
          include: {
            locations: {
              select: { id: true, code: true, name: true },
              orderBy: { code: 'asc' },
            },
          },
        },
      },
    });

    const unlinkedVariantGids = full.lineItems
      .filter((li) => !li.shopifyOrderLineItem && li.shopifyVariantGid)
      .map((li) => li.shopifyVariantGid!);
    const variantImageFallback = new Map<string, string | null>();
    if (unlinkedVariantGids.length > 0) {
      const imgRows = await prisma.shopifyOrderLineItem.findMany({
        where: { variantGid: { in: unlinkedVariantGids }, imageUrl: { not: null } },
        select: { variantGid: true, imageUrl: true },
        distinct: ['variantGid'],
      });
      for (const r of imgRows) {
        if (r.variantGid) variantImageFallback.set(r.variantGid, r.imageUrl);
      }
    }

    return NextResponse.json({
      ok: true,
      officeBlock: mapPrismaPoToBlock(full, variantImageFallback),
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'PATCH /api/purchase-orders/[id]/line-items');
  }
}

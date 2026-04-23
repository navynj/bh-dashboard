import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, purchaseOrderUpdateSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { recomputePurchaseOrderStatusById } from '@/lib/order/purchase-order-status';
import { mapPrismaPoToBlock } from '@/features/order/office/mappers/map-purchase-order';

type RouteContext = { params: Promise<{ id: string }> };

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
      include: {
        lineItems: {
          orderBy: { sequence: 'asc' },
          include: { shopifyOrderLineItem: true },
        },
        shopifyOrders: { include: { customer: true } },
        supplier: true,
        emailDeliveries: { orderBy: { sentAt: 'desc' } },
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 },
      );
    }

    // For line items without a linked ShopifyOrderLineItem (e.g. legacy imported POs),
    // fall back to imageUrl via variantGid so images still render.
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

    return NextResponse.json({ ok: true, officeBlock: mapPrismaPoToBlock(po, variantImageFallback) });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/purchase-orders/[id] error:');
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const result = await parseBody(request, purchaseOrderUpdateSchema);
    if ('error' in result) return result.error;
    const { data } = result;

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 },
      );
    }

    if (data.poNumber !== undefined) {
      const taken = await prisma.purchaseOrder.findFirst({
        where: { poNumber: data.poNumber, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          { error: 'This PO number is already in use.', code: 'PO_NUMBER_TAKEN' },
          { status: 409 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.poNumber !== undefined) updateData.poNumber = data.poNumber;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.comment !== undefined) updateData.comment = data.comment;
    if (data.expectedDate !== undefined) {
      updateData.expectedDate = data.expectedDate
        ? new Date(data.expectedDate)
        : null;
    }
    if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt
        ? new Date(data.completedAt)
        : null;
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
    });

    await recomputePurchaseOrderStatusById(id);

    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: {
        lineItems: { orderBy: { sequence: 'asc' } },
        shopifyOrders: true,
        supplier: true,
      },
    });

    return NextResponse.json({ ok: true, purchaseOrder: po });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'PUT /api/purchase-orders/[id] error:');
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 },
      );
    }

    await prisma.purchaseOrder.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'DELETE /api/purchase-orders/[id] error:');
  }
}

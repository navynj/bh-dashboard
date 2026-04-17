import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, purchaseOrderCreateSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { mapPrismaPoToBlock } from '@/features/order/office/mappers/map-purchase-order';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      orderBy: [{ dateCreated: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        poNumber: true,
        status: true,
        currency: true,
        isAuto: true,
        dateCreated: true,
        expectedDate: true,
        completedAt: true,
        totalPrice: true,
        supplierId: true,
        supplier: { select: { id: true, company: true } },
        _count: { select: { lineItems: true, shopifyOrders: true } },
      },
    });

    return NextResponse.json({ ok: true, purchaseOrders });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/purchase-orders error:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const result = await parseBody(request, purchaseOrderCreateSchema);
    if ('error' in result) return result.error;
    const { data } = result;

    if (data.poNumber !== 'AUTO') {
      const taken = await prisma.purchaseOrder.findUnique({
        where: { poNumber: data.poNumber },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          { error: 'This PO number is already in use.', code: 'PO_NUMBER_TAKEN' },
          { status: 409 },
        );
      }
    }

    const po = await prisma.$transaction(async (tx) => {
      let poNumber = data.poNumber;
      if (poNumber === 'AUTO') {
        const latest = await tx.purchaseOrder.findFirst({
          orderBy: { poNumber: 'desc' },
          select: { poNumber: true },
        });
        const lastNum = latest?.poNumber
          ? parseInt(latest.poNumber.replace(/\D/g, ''), 10) || 0
          : 0;
        poNumber = String(lastNum + 1);
      }

      const authorizedBy =
        session.user?.name?.trim() ||
        session.user?.email?.trim() ||
        null;

      const created = await tx.purchaseOrder.create({
        data: {
          poNumber,
          currency: data.currency,
          isAuto: data.isAuto,
          dateCreated: new Date(),
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          comment: data.comment ?? null,
          supplierId: data.supplierId!,
          shippingAddress: data.shippingAddress ?? undefined,
          billingAddress: data.billingAddress ?? undefined,
          billingSameAsShipping: data.billingSameAsShipping,
          authorizedBy,
        },
      });

      if (data.lineItems.length > 0) {
        await tx.purchaseOrderLineItem.createMany({
          data: data.lineItems.map((li, idx) => ({
            purchaseOrderId: created.id,
            sequence: idx + 1,
            quantity: li.quantity,
            sku: li.sku ?? null,
            variantTitle: li.variantTitle ?? null,
            productTitle: li.productTitle ?? null,
            itemPrice: li.itemPrice ?? null,
            supplierRef: li.supplierRef ?? null,
            isCustom: li.isCustom ?? false,
            shopifyVariantGid: li.shopifyVariantGid ?? null,
            shopifyProductGid: li.shopifyProductGid ?? null,
          })),
        });
      }

      // Link to existing ShopifyOrder records by order name
      if (data.shopifyOrderRefs && data.shopifyOrderRefs.length > 0) {
        const orderNames = data.shopifyOrderRefs.map((ref) => ref.orderNumber);
        const matchedOrders = await tx.shopifyOrder.findMany({
          where: { name: { in: orderNames } },
          select: { id: true },
        });
        if (matchedOrders.length > 0) {
          await tx.purchaseOrder.update({
            where: { id: created.id },
            data: {
              shopifyOrders: {
                connect: matchedOrders.map((o) => ({ id: o.id })),
              },
            },
          });
        }
      }

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          lineItems: {
            orderBy: { sequence: 'asc' },
            include: { shopifyOrderLineItem: true },
          },
          shopifyOrders: { include: { customer: true } },
          supplier: true,
          emailDeliveries: true,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        purchaseOrder: po,
        officeBlock: mapPrismaPoToBlock(po),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/purchase-orders error:');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, purchaseOrderCreateSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { mapPrismaPoToBlock } from '@/features/order/office/mappers/map-purchase-order';
import { resolvePoCreateLineShopifyLinks } from '@/lib/order/resolve-po-create-line-shopify-links';
import { loadVariantOfficeNotesMap } from '@/lib/order/shopify-variant-office-note';

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

      const orderNamesFromRefs = (data.shopifyOrderRefs ?? []).map(
        (ref) => ref.orderNumber,
      );
      const { shopifyOrderIds, lineShopifyOrderLineItemIds } =
        await resolvePoCreateLineShopifyLinks(tx, orderNamesFromRefs, data.lineItems);

      if (data.lineItems.length > 0) {
        const soliIds = lineShopifyOrderLineItemIds.filter((id): id is string => Boolean(id));
        const soliById =
          soliIds.length > 0
            ? new Map(
                (
                  await tx.shopifyOrderLineItem.findMany({
                    where: { id: { in: soliIds } },
                    select: { id: true, variantGid: true },
                  })
                ).map((r) => [r.id, r.variantGid]),
              )
            : new Map<string, string | null>();

        const resolvedVariantGids: string[] = [];
        for (let idx = 0; idx < data.lineItems.length; idx++) {
          const li = data.lineItems[idx];
          let vg = li.shopifyVariantGid?.trim() ?? null;
          if (!vg) {
            const sid = lineShopifyOrderLineItemIds[idx];
            if (sid) vg = soliById.get(sid)?.trim() ?? null;
          }
          if (vg) resolvedVariantGids.push(vg);
        }
        const noteByVariant = await loadVariantOfficeNotesMap(tx, resolvedVariantGids);

        await tx.purchaseOrderLineItem.createMany({
          data: data.lineItems.map((li, idx) => {
            let vg = li.shopifyVariantGid?.trim() ?? null;
            if (!vg) {
              const sid = lineShopifyOrderLineItemIds[idx];
              if (sid) vg = soliById.get(sid)?.trim() ?? null;
            }
            const defaultNote = vg ? noteByVariant.get(vg) ?? null : null;
            return {
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
              shopifyOrderLineItemId: lineShopifyOrderLineItemIds[idx] ?? null,
              note: defaultNote,
            };
          }),
        });
      }

      if (shopifyOrderIds.length > 0) {
        await tx.purchaseOrder.update({
          where: { id: created.id },
          data: {
            shopifyOrders: {
              connect: shopifyOrderIds.map((id) => ({ id })),
            },
          },
        });
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

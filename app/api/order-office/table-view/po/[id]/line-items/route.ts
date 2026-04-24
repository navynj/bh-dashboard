import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';
import type { OfficePoTableLineItem } from '@/features/order/office/types/office-table-view';

type RouteContext = { params: Promise<{ id: string }> };

function dec(d: Prisma.Decimal | null | undefined): string | null {
  if (d == null) return null;
  return typeof d === 'object' && 'toFixed' in d
    ? (d as Prisma.Decimal).toFixed(2)
    : String(d);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const { id: purchaseOrderId } = await context.params;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        poNumber: true,
        currency: true,
        supplier: { select: { company: true } },
        lineItems: {
          orderBy: { sequence: 'asc' },
          select: {
            sequence: true,
            productTitle: true,
            variantTitle: true,
            sku: true,
            quantity: true,
            supplierRef: true,
            itemPrice: true,
          },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const lines: OfficePoTableLineItem[] = po.lineItems.map((l) => ({
      sequence: l.sequence,
      productTitle: l.productTitle,
      variantTitle: l.variantTitle,
      sku: l.sku,
      quantity: l.quantity,
      supplierRef: l.supplierRef,
      itemPrice: dec(l.itemPrice),
    }));

    return NextResponse.json({
      ok: true,
      poNumber: po.poNumber,
      supplierCompany: po.supplier.company,
      currency: po.currency,
      lines,
    });
  } catch (err: unknown) {
    return toApiErrorResponse(
      err,
      'GET /api/order-office/table-view/po/[id]/line-items',
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';

const UNKNOWN_CUSTOMER_KEY = '__unknown_customer__';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        supplierId: true,
        shopifyOrders: {
          take: 1,
          select: { customerId: true },
          orderBy: { shopifyCreatedAt: 'desc' },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const custKey =
      po.shopifyOrders[0]?.customerId ?? UNKNOWN_CUSTOMER_KEY;
    const supplierKey = `${custKey}::${po.supplierId}`;

    return NextResponse.json({ ok: true, supplierKey });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/order-office/table-view/resolve-po-key error:');
  }
}

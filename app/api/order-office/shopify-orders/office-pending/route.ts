import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, shopifyOrdersOfficePendingPostSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const result = await parseBody(request, shopifyOrdersOfficePendingPostSchema);
    if ('error' in result) return result.error;
    const { shopifyOrderIds, pending } = result.data;

    await prisma.shopifyOrder.updateMany({
      where: { id: { in: shopifyOrderIds } },
      data: { officePendingAt: pending ? new Date() : null },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return toApiErrorResponse(
      err,
      'POST /api/order-office/shopify-orders/office-pending error:',
    );
  }
}

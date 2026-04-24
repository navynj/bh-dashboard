import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, shopifyVariantOfficeNotePutSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { upsertShopifyVariantOfficeNote } from '@/lib/order/shopify-variant-office-note';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const rows = await prisma.shopifyVariantOfficeNote.findMany({
      select: { shopifyVariantGid: true, note: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      notes: rows.map((r) => ({
        shopifyVariantGid: r.shopifyVariantGid,
        note: r.note,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/order-office/shopify-variant-notes');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const parsed = await parseBody(request, shopifyVariantOfficeNotePutSchema);
    if ('error' in parsed) return parsed.error;
    const { data } = parsed;

    await upsertShopifyVariantOfficeNote(prisma, data.shopifyVariantGid, data.note);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'PUT /api/order-office/shopify-variant-notes');
  }
}

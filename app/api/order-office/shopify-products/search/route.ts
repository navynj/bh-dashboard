import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { toApiErrorResponse } from '@/lib/core/errors';
import { isShopifyAdminEnvConfigured } from '@/lib/shopify/env';
import { searchProductsForOfficeFromEnv } from '@/lib/shopify/searchProducts';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    if (!isShopifyAdminEnvConfigured()) {
      return NextResponse.json(
        { error: 'Shopify Admin API is not configured on the server.' },
        { status: 503 },
      );
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json(
        { error: 'Enter at least 2 characters to search.' },
        { status: 400 },
      );
    }

    const hits = await searchProductsForOfficeFromEnv(q, 12);
    return NextResponse.json({ ok: true, hits });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/order-office/shopify-products/search');
  }
}

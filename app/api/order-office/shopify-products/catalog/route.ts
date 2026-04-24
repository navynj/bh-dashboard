import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { toApiErrorResponse } from '@/lib/core/errors';
import { getShopifyAdminEnv, isShopifyAdminEnvConfigured } from '@/lib/shopify/env';
import { fetchProductsCatalogPage } from '@/lib/shopify/listProductsCatalog';

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

    const sp = request.nextUrl.searchParams;
    const after = sp.get('after')?.trim() || null;
    const vendor = sp.get('vendor')?.trim() || null;
    const title =
      sp.get('title')?.trim() ||
      sp.get('q')?.trim() ||
      null;
    const firstRaw = sp.get('first');
    const first = Math.min(
      50,
      Math.max(1, firstRaw ? parseInt(firstRaw, 10) || 25 : 25),
    );

    const page = await fetchProductsCatalogPage(getShopifyAdminEnv(), {
      first,
      after,
      vendorFilter: vendor,
      titleSearch: title,
    });

    return NextResponse.json({
      ok: true,
      rows: page.rows,
      endCursor: page.endCursor,
      hasNextPage: page.hasNextPage,
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/order-office/shopify-products/catalog');
  }
}

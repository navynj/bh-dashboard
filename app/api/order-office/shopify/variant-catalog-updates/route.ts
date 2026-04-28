import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { parseBody, shopifyVariantCatalogUpdatesBodySchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { getShopifyAdminEnv } from '@/lib/shopify/env';
import { applyVariantCatalogPriceUpdates } from '@/lib/shopify/orderEdit';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const parsed = await parseBody(request, shopifyVariantCatalogUpdatesBodySchema);
    if ('error' in parsed) return parsed.error;
    const { data } = parsed;

    const creds = getShopifyAdminEnv();
    await applyVariantCatalogPriceUpdates(creds, data.updates);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/order-office/shopify/variant-catalog-updates');
  }
}

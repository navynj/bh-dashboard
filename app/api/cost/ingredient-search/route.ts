import { NextRequest, NextResponse } from 'next/server';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';
import { fetchIngredientSearchPageFromEnv } from '@/lib/shopify/searchProducts';
import { fetchShopifyProductByVariantId } from '@/lib/shopify/fetchByVariant';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json({ error: 'Enter at least 2 characters.' }, { status: 400 });
    }

    const cursor = req.nextUrl.searchParams.get('cursor') ?? null;

    const shopifyConfig = await prisma.shopifyConfig.findFirst();
    if (!shopifyConfig) {
      return NextResponse.json({ error: 'Shopify not configured.' }, { status: 503 });
    }

    const { hits, nextCursor, hasMore } = await fetchIngredientSearchPageFromEnv(q, cursor);

    // Enrich each hit with unitPrice / gPrice from variant metadata
    type EnrichedProduct = {
      variantId: string;
      productId: string;
      title: string;
      variantTitle: string | null;
      sku: string | null;
      status: string;
      imageUrl: string | null;
      unitPrice: number | null;
      gPrice: number | null;
      unit: string;
      gPerPc: number | null;
      metadata: Record<string, unknown> | null;
    };

    const enriched = await Promise.allSettled(
      hits.map(async (hit): Promise<EnrichedProduct> => {
        try {
          const { products } = await fetchShopifyProductByVariantId(shopifyConfig, hit.variantId);
          const p = products[0];
          return {
            variantId: hit.variantId,
            productId: hit.productId,
            title: hit.productTitle,
            variantTitle: hit.variantTitle,
            sku: hit.sku,
            status: hit.productStatus,
            imageUrl: hit.imageUrl,
            unitPrice: p?.unitPrice ?? null,
            gPrice: p?.gPrice ?? null,
            unit: (p?.metadata?.unit as string | undefined) ?? 'pc',
            gPerPc: (p?.metadata?.g_per_pc as number | undefined) ?? null,
            metadata: p?.metadata ?? null,
          };
        } catch {
          return {
            variantId: hit.variantId,
            productId: hit.productId,
            title: hit.productTitle,
            variantTitle: hit.variantTitle,
            sku: hit.sku,
            status: hit.productStatus,
            imageUrl: hit.imageUrl,
            unitPrice: hit.price ? parseFloat(hit.price) : null,
            gPrice: null,
            unit: 'pc',
            gPerPc: null,
            metadata: null,
          };
        }
      }),
    );

    const products = enriched
      .filter((r): r is PromiseFulfilledResult<EnrichedProduct> => r.status === 'fulfilled')
      .map((r) => r.value);

    return NextResponse.json({ products, nextCursor, hasMore });
  } catch (err) {
    return toApiErrorResponse(err, 'GET /api/cost/ingredient-search error:');
  }
}

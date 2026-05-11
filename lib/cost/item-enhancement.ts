import { fetchShopifyProductByVariantId } from '@/lib/shopify/fetchByVariant';
import { prisma } from '@/lib/core/prisma';
import type { ShopifyConfig } from '@/types/shopify';

interface RawItem {
  id: string;
  title: string;
  unit: string;
  amount: number;
  costId: string;
  variantId: string;
  type: string;
  image: unknown;
  rank: string;
}

interface EnhancedItem extends RawItem {
  unitPrice: number | null;
  amountPrice: number | null;
  gPrice: number | null;
  metadata?: Record<string, unknown>;
}

/** Re-derives gPrice for cost-type items by fetching the referenced sub-cost. */
async function enhanceCostTypeItem(item: RawItem): Promise<EnhancedItem> {
  if (!item.variantId) {
    return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
  }
  try {
    const subCost = await prisma.cost.findUnique({
      where: { id: item.variantId },
      include: { prices: { orderBy: { rank: 'asc' } } },
    });
    if (!subCost) return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
    const unitPrice =
      subCost.prices.find((p) => p.isFinalPrice)?.price ?? subCost.prices[0]?.price ?? 0;
    const finalWeight = subCost.finalWeight ?? 0;
    const gPrice = finalWeight > 0 ? unitPrice / finalWeight : null;
    const amountPrice = gPrice != null ? gPrice * item.amount : null;
    return { ...item, unitPrice, amountPrice, gPrice };
  } catch {
    return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
  }
}

async function enhanceItem(item: RawItem, config: ShopifyConfig): Promise<EnhancedItem> {
  if (item.type === 'cost') {
    return enhanceCostTypeItem(item);
  }
  if (!item.variantId) {
    return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
  }
  try {
    const { products } = await fetchShopifyProductByVariantId(config, item.variantId);
    const p = products[0];
    if (!p) return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
    const unitPrice = p.unitPrice ?? null;
    const gPrice = p.gPrice ?? null;
    const amountPrice = gPrice != null ? gPrice * item.amount : unitPrice != null ? unitPrice * item.amount : null;
    return {
      ...item,
      image: p.thumbnail ?? item.image,
      unitPrice,
      amountPrice,
      gPrice,
      metadata: p.metadata as Record<string, unknown> | undefined,
    };
  } catch {
    return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
  }
}

interface CostWithItems {
  ingredients: RawItem[];
  packagings: RawItem[];
  [key: string]: unknown;
}

export async function enhanceCostItems<T extends CostWithItems>(
  cost: T,
  shopifyConfig: ShopifyConfig,
): Promise<T & { ingredients: EnhancedItem[]; packagings: EnhancedItem[] }> {
  const [ingResults, pkgResults] = await Promise.all([
    Promise.allSettled(cost.ingredients.map((i) => enhanceItem(i, shopifyConfig))),
    Promise.allSettled(cost.packagings.map((p) => enhanceItem(p, shopifyConfig))),
  ]);

  const ingredients = ingResults.map((r, idx) =>
    r.status === 'fulfilled' ? r.value : { ...cost.ingredients[idx]!, unitPrice: null, amountPrice: null, gPrice: null },
  );
  const packagings = pkgResults.map((r, idx) =>
    r.status === 'fulfilled' ? r.value : { ...cost.packagings[idx]!, unitPrice: null, amountPrice: null, gPrice: null },
  );

  return { ...cost, ingredients, packagings };
}

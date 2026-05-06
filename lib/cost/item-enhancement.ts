import { fetchShopifyProductByVariantId } from '@/lib/shopify/fetchByVariant';
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

async function enhanceItem(item: RawItem, config: ShopifyConfig): Promise<EnhancedItem> {
  if (!item.variantId) {
    return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
  }
  try {
    const { products } = await fetchShopifyProductByVariantId(config, item.variantId);
    const p = products[0];
    if (!p) return { ...item, unitPrice: null, amountPrice: null, gPrice: null };
    const unitPrice = p.unitPrice ?? null;
    const gPrice = p.gPrice ?? null;
    const amountPrice = unitPrice != null ? unitPrice * item.amount : null;
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

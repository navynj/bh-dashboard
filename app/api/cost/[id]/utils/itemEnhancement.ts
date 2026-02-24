/**
 * Item enhancement: enrich ingredients/packagings with Shopify unitPrice, amountPrice, gPrice.
 * Uses first ShopifyConfig row when present; otherwise returns nulls.
 */

import { unitToGram } from '@/constants/cost/unit';
import type { ShopifyConfig, ProductMetadata } from '@/types/shopify';
import {
  calculateGPriceFromUnitPrice,
  calculateUnitPrice,
} from '@/lib/shopify/calculations';
import { fetchShopifyProductByVariantId } from '@/lib/shopify/fetchByVariant';

export interface ItemEnhancementResult {
  unitPrice: number | null;
  amountPrice: number | null;
  gPrice: number | null;
  metadata: ProductMetadata | null;
}

export interface EnhanceableItem {
  variantId: string;
  amount: number;
  unit: string;
  title?: string;
  type?: string;
}

export async function enhanceItemWithShopifyData(
  item: EnhanceableItem,
  shopifyConfig: ShopifyConfig | null,
): Promise<ItemEnhancementResult> {
  let metadata: ProductMetadata | null = null;
  let unitPrice: number | null = null;
  let amountPrice: number | null = null;

  const isCostType = item.type === 'Cost';

  if (item.variantId && shopifyConfig && !isCostType) {
    try {
      const productData = await fetchShopifyProductByVariantId(
        shopifyConfig,
        item.variantId,
      );
      const product = productData?.products?.[0];

      if (product) {
        if (product.metadata) {
          metadata = product.metadata as ProductMetadata;
        }
        unitPrice = product.unitPrice ?? calculateUnitPrice(product) ?? null;

        if (unitPrice !== null) {
          const metadataUnit =
            metadata?.unit?.toLowerCase() || item.unit?.toLowerCase();
          let amountInUnit: number;

          if (metadataUnit === 'g') {
            amountInUnit = item.amount;
          } else if (metadataUnit === 'pc') {
            const gPerPc = metadata?.g_per_pc;
            if (gPerPc && gPerPc > 0) {
              amountInUnit = item.amount / gPerPc;
            } else {
              amountInUnit = 0;
            }
          } else {
            const conversionFactor = unitToGram[metadataUnit];
            if (conversionFactor && conversionFactor > 0) {
              amountInUnit = item.amount / conversionFactor;
            } else {
              amountInUnit = 0;
            }
          }
          amountPrice = unitPrice * amountInUnit;
        }
      }
    } catch (error) {
      console.error(
        'Error fetching product for variantId',
        item.variantId,
        error,
      );
    }
  }

  let gPrice: number | null = null;
  if (unitPrice !== null) {
    if (metadata?.unit) {
      gPrice = calculateGPriceFromUnitPrice(unitPrice, metadata.unit, metadata);
    } else if (item.unit) {
      gPrice = calculateGPriceFromUnitPrice(
        unitPrice,
        item.unit,
        metadata ?? undefined,
      );
    }
  }

  return {
    unitPrice,
    amountPrice,
    gPrice,
    metadata,
  };
}

export async function processItemsWithShopifyData<T extends EnhanceableItem>(
  items: T[],
  shopifyConfig: ShopifyConfig | null,
  _itemType: string,
): Promise<(T & ItemEnhancementResult)[]> {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const enhancedData = await enhanceItemWithShopifyData(
        item,
        shopifyConfig,
      );
      return { ...item, ...enhancedData };
    }),
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const item = items[index];
    return {
      ...item,
      unitPrice: null,
      amountPrice: null,
      gPrice: null,
      metadata: null,
    };
  });
}

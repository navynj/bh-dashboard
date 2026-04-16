import type { ShopifyOrderLineNode } from '@/types/shopify';

/** Best-effort image URL from a synced order line (line-level, variant, or product). */
export function lineItemImageUrlFromShopifyNode(
  li: Pick<ShopifyOrderLineNode, 'image' | 'variant'>,
): string | null {
  const fromLine = li.image?.url?.trim();
  if (fromLine) return fromLine;
  const fromVariant = li.variant?.image?.url?.trim();
  if (fromVariant) return fromVariant;
  const fromProduct = li.variant?.product?.featuredImage?.url?.trim();
  if (fromProduct) return fromProduct;
  return null;
}

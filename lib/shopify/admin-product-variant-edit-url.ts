/** Numeric tail of a Shopify Admin GID (`gid://shopify/Product/123` → `123`). */
export function shopifyGidToLegacyResourceId(
  gid: string | null | undefined,
): string | null {
  if (!gid?.trim()) return null;
  const m = gid.trim().match(/\/(\d+)\s*$/);
  return m?.[1] ?? null;
}

/**
 * New Admin deep link to the product variant editor.
 * @see https://admin.shopify.com/store/{handle}/products/{productId}/variants/{variantId}
 */
export function buildShopifyAdminProductVariantEditUrl(params: {
  storeHandle: string;
  productGid?: string | null;
  variantGid?: string | null;
}): string | null {
  const handle = params.storeHandle.trim();
  if (!handle) return null;
  const productId = shopifyGidToLegacyResourceId(params.productGid ?? null);
  const variantId = shopifyGidToLegacyResourceId(params.variantGid ?? null);
  const base = `https://admin.shopify.com/store/${encodeURIComponent(handle)}`;
  if (productId && variantId) return `${base}/products/${productId}/variants/${variantId}`;
  if (productId) return `${base}/products/${productId}`;
  return null;
}

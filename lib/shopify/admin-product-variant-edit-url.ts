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
  /** Legacy / mistaken call sites used these keys; treat as aliases of `productGid` / `variantGid`. */
  shopifyProductGid?: string | null;
  shopifyVariantGid?: string | null;
}): string | null {
  const handle = params.storeHandle.trim();
  if (!handle) return null;
  const productGid = params.productGid ?? params.shopifyProductGid ?? null;
  const variantGid = params.variantGid ?? params.shopifyVariantGid ?? null;
  const productId = shopifyGidToLegacyResourceId(productGid);
  const variantId = shopifyGidToLegacyResourceId(variantGid);
  const base = `https://admin.shopify.com/store/${encodeURIComponent(handle)}`;
  if (productId && variantId) return `${base}/products/${productId}/variants/${variantId}`;
  if (productId) return `${base}/products/${productId}`;
  return null;
}

/** New Admin deep link to the product page. */
export function buildShopifyAdminProductUrl(params: {
  storeHandle: string;
  productGid?: string | null;
}): string | null {
  const handle = params.storeHandle.trim();
  if (!handle) return null;
  const productId = shopifyGidToLegacyResourceId(params.productGid ?? null);
  if (!productId) return null;
  const base = `https://admin.shopify.com/store/${encodeURIComponent(handle)}`;
  return `${base}/products/${productId}`;
}

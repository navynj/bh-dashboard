/** Store hostname from Shopify (order admin lives under `/admin/orders/:id`). */
const SHOPIFY_MY_SHOPIFY_HOST = 'bhfood.myshopify.com';

/** Numeric id from Admin API GID `gid://shopify/Order/123`. */
export function shopifyOrderNumericIdFromGid(shopifyGid: string): string | null {
  const m = /\/Order\/(\d+)\s*$/.exec(shopifyGid.trim());
  return m?.[1] ?? null;
}

/** `https://bhfood.myshopify.com/admin/orders/{id}` for opening in a new tab. */
export function shopifyMyshopifyAdminOrderUrl(shopifyGid: string): string | null {
  const id = shopifyOrderNumericIdFromGid(shopifyGid);
  if (!id) return null;
  return `https://${SHOPIFY_MY_SHOPIFY_HOST}/admin/orders/${id}`;
}

/**
 * Extracts the Shopify Admin "store" segment from `SHOPIFY_SHOP_DOMAIN`
 * (e.g. `https://bhfood.myshopify.com` → `bhfood`).
 */
export function parseMyshopifyStoreHandle(shopDomain: string): string | null {
  const raw = shopDomain.trim();
  if (!raw) return null;
  const host = raw
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    ?.replace(/:\d+$/, '')
    ?.trim();
  if (!host) return null;
  const m = /^([\w-]+)\.myshopify\.com$/i.exec(host);
  if (m?.[1]) return m[1].toLowerCase();
  if (/^[\w-]+$/.test(host) && !host.includes('.')) return host.toLowerCase();
  return null;
}

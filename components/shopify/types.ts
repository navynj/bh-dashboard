/**
 * Shared types for Shopify Admin product search UIs (order, cost, inventory, …).
 * Matches `GET /api/order-office/shopify-products/search` → `{ hits[] }`.
 */

export type ShopifyProductSearchHit = {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string | null;
  sku: string | null;
  price: string | null;
  unitCost?: string | null;
  imageUrl?: string | null;
};

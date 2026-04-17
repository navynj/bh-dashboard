export type PrePoLineDraft = {
  /** Local `ShopifyOrderLineItem.id` for API edits. */
  shopifyLineItemId?: string;
  /** Shopify LineItem GID (`gid://shopify/LineItem/...`). */
  shopifyLineItemGid?: string | null;
  shopifyVariantGid?: string | null;
  /** When known (e.g. search), used for optional catalog price updates. */
  shopifyProductGid?: string | null;
  /** Synced product/variant image URL from Shopify. */
  imageUrl?: string | null;
  sku: string | null;
  productTitle: string;
  itemPrice: string | null;
  /** Variant unit cost from Shopify inventory, when synced. */
  itemCost?: string | null;
  quantity: number;
  includeInPo: boolean;
  disabled?: boolean;
};

export type ShopifyOrderDraft = {
  id: string;
  /** Hub DB `shopify_orders.archived_at` (ISO); null = not archived. */
  archivedAt?: string | null;
  /** Shopify Order GID for Admin order edits. */
  shopifyOrderGid: string;
  /** ISO currency from synced order (e.g. CAD). */
  currencyCode: string | null;
  orderNumber: string;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddressLine: string | null;
  customerDisplayName: string | null;
  orderedAt: string | null;
  note?: string;
  noteIsWarning?: boolean;
  lineItems: PrePoLineDraft[];
};

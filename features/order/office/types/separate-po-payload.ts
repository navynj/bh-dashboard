import type { PoAddress } from './purchase-order';

export type SeparatePoLinePayload = {
  sku: string | null;
  productTitle: string;
  quantity: number;
  itemPrice: number | null;
  isCustom?: boolean;
  shopifyLineItemId?: string | null;
  shopifyLineItemGid?: string | null;
  shopifyVariantGid?: string | null;
  shopifyProductGid?: string | null;
  /** Effective PO line note (default or overridden in Inbox). */
  note?: string | null;
};

export type SeparatePoPayload = {
  expectedDate: string | null;
  comment: string | null;
  shopifyOrderNumber: string;
  /**
   * PO number for create (same convention as Meta “auto”, editable in Separate PO dialog).
   * Trimmed empty → server uses `AUTO`.
   */
  poNumber: string;
  /** Parsed from Shopify order shipping when complete; null if unknown / cleared. */
  shippingAddress: PoAddress | null;
  lineItems: SeparatePoLinePayload[];
};

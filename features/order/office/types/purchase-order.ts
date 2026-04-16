import type { ShopifyOrderDisplayFulfillmentStatus } from '@/types/shopify';

export type PurchaseOrderStatus =
  | 'unfulfilled'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'completed';

export type LineFulfillmentStatus = ShopifyOrderDisplayFulfillmentStatus;

export type PoLineItemView = {
  id: string;
  purchaseOrderId: string;
  sequence: number;
  quantity: number;
  quantityReceived: number;
  supplierRef: string | null;
  sku: string | null;
  variantTitle: string | null;
  productTitle: string | null;
  /** From linked Shopify order line when available. */
  imageUrl?: string | null;
  isCustom: boolean;
  itemPrice: string | null;
  /** Local `ShopifyOrderLineItem.id` when line is tied to a synced Shopify line. */
  shopifyOrderLineItemId?: string | null;
  shopifyLineItemGid?: string | null;
  shopifyVariantGid?: string | null;
  shopifyProductGid?: string | null;
  /** Local `ShopifyOrder.id` for the source customer order. */
  shopifyOrderId?: string | null;
  shopifyOrderNumber: string;
  fulfillmentStatus: LineFulfillmentStatus;
};

export type LinkedShopifyOrder = {
  id: string;
  name: string;
  customerName: string | null;
  fulfillmentStatus: string | null;
};

export type PoAddress = {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

export type PoPanelMeta = {
  poNumber: string;
  status: PurchaseOrderStatus;
  currency: string;
  orderedAt: string | null;
  dateCreated: string | null;
  expectedDate: string | null;
  fulfillDoneCount: number;
  fulfillPendingCount: number;
  fulfillTotalCount: number;
  linkedShopifyOrders: LinkedShopifyOrder[];
  lastSyncedAt: string | null;
  shippingAddress: PoAddress | null;
  billingAddress: PoAddress | null;
  billingSameAsShipping: boolean;
};

export type OfficePurchaseOrderBlock = {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  currency: string;
  isAuto: boolean;
  title: string;
  shopifyOrderCount: number;
  lineItems: PoLineItemView[];
  subtreeRowLabel?: string;
  panelMeta?: PoPanelMeta;
};

export function formatProductLabel(line: PoLineItemView): string {
  const title = line.productTitle ?? '(untitled)';
  if (line.variantTitle) {
    return `${title} — ${line.variantTitle}`;
  }
  return title;
}

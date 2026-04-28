/**
 * Shopify API types (hub: no organizationId on config)
 */
export interface ShopifyConfig {
  id: string;
  shopifyUrl: string;
  adminToken: string;
  apiVersion: string;
  query: string | null;
}

export interface ProductMetadata {
  unit?: string;
  split_unit?: number;
  pak_unit?: number;
  g_per_pc?: number;
  [key: string]: unknown;
}

export interface ProductImage {
  alt: string;
  src: string;
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  inventoryItem?: {
    unitCost?: { amount: string };
  };
}

export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  productType?: string;
  status: string;
  vendor?: string;
  price?: string | number;
  variantId?: string;
  metadata?: ProductMetadata;
  thumbnail?: ProductImage;
  thumbnails?: ProductImage[];
  variants?: { nodes: ShopifyProductVariant[] };
  media?: {
    nodes: Array<{
      preview?: { image?: { altText?: string; url: string } };
    }>;
  };
  metafield?: { jsonValue?: string[] };
  unitPrice?: number;
  gPrice?: number | null;
  active?: boolean;
}

export interface ShopifyMetaobjectField {
  key: string;
  value: string;
  type: string;
}

export interface ShopifyMetaobjectResponse {
  metaobject: { fields: ShopifyMetaobjectField[] };
}

/** Credentials for Admin API (GraphQL) — env: `SHOPIFY_*` or passed explicitly. */
export interface ShopifyAdminCredentials {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

/** GraphQL `orders` query page (Admin API). */
export interface ShopifyOrdersPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/** `Product` / `ProductVariant` media connection from order line queries (`... on MediaImage`). */
export type ShopifyOrderLineMediaConnection = {
  edges?: ReadonlyArray<{ node?: unknown } | null> | null;
} | null;

/** Product image fields queried on order line items (legacy + unified media). */
export type ShopifyOrderLineProductImages = {
  /** `gid://shopify/Product/...` when the selection includes `product { id }`. */
  id?: string | null;
  featuredImage?: { url: string | null } | null;
  /** `Media` resolved as `MediaImage` in GraphQL; other media kinds omitted. */
  featuredMedia?: unknown;
  media?: ShopifyOrderLineMediaConnection;
};

/** GraphQL `LineItem.id` — `gid://shopify/LineItem/...` */
export interface ShopifyOrderLineNode {
  id: string;
  title: string;
  quantity: number;
  /**
   * GraphQL `LineItem.currentQuantity` — units remaining after order-edit removals.
   * When omitted, callers should treat {@link quantity} as the effective count.
   */
  currentQuantity?: number | null;
  sku: string | null;
  vendor: string | null;
  /** Line-item snapshot image when present. */
  image?: { url: string | null } | null;
  discountedUnitPriceSet?: {
    shopMoney?: { amount: string; currencyCode?: string } | null;
  } | null;
  /** Same catalog product as `variant.product` when a variant exists. */
  product?: ShopifyOrderLineProductImages | null;
  variant: {
    id: string;
    title: string | null;
    sku: string | null;
    image?: { url: string | null } | null;
    media?: ShopifyOrderLineMediaConnection;
    product?: ShopifyOrderLineProductImages | null;
    inventoryItem?: {
      unitCost?: { amount: string } | null;
    } | null;
  } | null;
}

/** Order.customer (null for some guest checkouts). */
export interface ShopifyOrderCustomer {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  defaultAddress?: ShopifyMailingAddress | null;
}

/**
 * Shopify Admin GraphQL enum `OrderDisplayFinancialStatus` (`Order.displayFinancialStatus`).
 * @see https://shopify.dev/docs/api/admin-graphql/latest/enums/OrderDisplayFinancialStatus
 */
export const SHOPIFY_ORDER_DISPLAY_FINANCIAL_STATUSES = [
  'AUTHORIZED',
  'EXPIRED',
  'PAID',
  'PARTIALLY_PAID',
  'PARTIALLY_REFUNDED',
  'PENDING',
  'REFUNDED',
  'VOIDED',
] as const;

export type ShopifyOrderDisplayFinancialStatus =
  (typeof SHOPIFY_ORDER_DISPLAY_FINANCIAL_STATUSES)[number];

/**
 * Shopify Admin GraphQL enum `OrderDisplayFulfillmentStatus` (`Order.displayFulfillmentStatus`).
 * @see https://shopify.dev/docs/api/admin-graphql/latest/enums/OrderDisplayFulfillmentStatus
 */
export const SHOPIFY_ORDER_DISPLAY_FULFILLMENT_STATUSES = [
  'FULFILLED',
  'IN_PROGRESS',
  'ON_HOLD',
  'OPEN',
  'PARTIALLY_FULFILLED',
  'PENDING_FULFILLMENT',
  'REQUEST_DECLINED',
  'RESTOCKED',
  'SCHEDULED',
  'UNFULFILLED',
] as const;

export type ShopifyOrderDisplayFulfillmentStatus =
  (typeof SHOPIFY_ORDER_DISPLAY_FULFILLMENT_STATUSES)[number];

export function isShopifyOrderDisplayFinancialStatus(
  value: string,
): value is ShopifyOrderDisplayFinancialStatus {
  return (SHOPIFY_ORDER_DISPLAY_FINANCIAL_STATUSES as readonly string[]).includes(value);
}

/** `Order.displayFinancialStatus` — voided orders should be excluded from office inbox queues. */
export function isShopifyOrderFinancialVoided(
  status: string | null | undefined,
): boolean {
  if (status == null || status === '') return false;
  return status.trim().toUpperCase() === 'VOIDED';
}

export function isShopifyOrderDisplayFulfillmentStatus(
  value: string,
): value is ShopifyOrderDisplayFulfillmentStatus {
  return (SHOPIFY_ORDER_DISPLAY_FULFILLMENT_STATUSES as readonly string[]).includes(value);
}

const SHOPIFY_ORDER_DISPLAY_FINANCIAL_LABELS: Record<
  ShopifyOrderDisplayFinancialStatus,
  string
> = {
  AUTHORIZED: 'Authorized',
  EXPIRED: 'Expired',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially paid',
  PARTIALLY_REFUNDED: 'Partially refunded',
  PENDING: 'Pending',
  REFUNDED: 'Refunded',
  VOIDED: 'Voided',
};

const SHOPIFY_ORDER_DISPLAY_FULFILLMENT_LABELS: Record<
  ShopifyOrderDisplayFulfillmentStatus,
  string
> = {
  FULFILLED: 'Fulfilled',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  OPEN: 'Open',
  PARTIALLY_FULFILLED: 'Partially fulfilled',
  PENDING_FULFILLMENT: 'Pending fulfillment',
  REQUEST_DECLINED: 'Request declined',
  RESTOCKED: 'Restocked',
  SCHEDULED: 'Scheduled',
  UNFULFILLED: 'Unfulfilled',
};

/** Human-readable label; unknown strings pass through (forward-compatible). */
export function formatShopifyOrderDisplayFinancialStatus(
  status: string | null | undefined,
): string {
  if (status == null || status === '') return '—';
  if (isShopifyOrderDisplayFinancialStatus(status)) {
    return SHOPIFY_ORDER_DISPLAY_FINANCIAL_LABELS[status];
  }
  return status;
}

/** Human-readable label; unknown strings pass through (forward-compatible). */
export function formatShopifyOrderDisplayFulfillmentStatus(
  status: string | null | undefined,
): string {
  if (status == null || status === '') return '—';
  if (isShopifyOrderDisplayFulfillmentStatus(status)) {
    return SHOPIFY_ORDER_DISPLAY_FULFILLMENT_LABELS[status];
  }
  return status;
}

export interface ShopifyMailingAddress {
  address1: string | null;
  address2: string | null;
  city: string | null;
  /** Full region name; often empty when only `provinceCode` is set. */
  province: string | null;
  /** ISO-style region code (e.g. ON, BC); prefer this for Canadian dropdowns. */
  provinceCode?: string | null;
  country: string | null;
  zip: string | null;
  company: string | null;
  name: string | null;
  phone: string | null;
}

export interface ShopifyOrderNode {
  id: string;
  name: string | null;
  email: string | null;
  /** Shopify `Order.note` (checkout / customer order note). */
  note?: string | null;
  customer: ShopifyOrderCustomer | null;
  processedAt: string | null;
  createdAt: string;
  displayFinancialStatus: ShopifyOrderDisplayFinancialStatus | null;
  displayFulfillmentStatus: ShopifyOrderDisplayFulfillmentStatus | null;
  currencyCode: string;
  totalPriceSet: {
    shopMoney: { amount: string; currencyCode: string };
  };
  billingAddress: ShopifyMailingAddress | null;
  shippingAddress: ShopifyMailingAddress | null;
  lineItems: {
    edges: Array<{ node: ShopifyOrderLineNode }>;
  };
}

export interface ShopifyOrdersQueryData {
  orders: {
    edges: Array<{ cursor: string; node: ShopifyOrderNode }>;
    pageInfo: ShopifyOrdersPageInfo;
  };
}

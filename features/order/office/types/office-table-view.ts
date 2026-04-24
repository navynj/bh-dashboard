/** Serializable rows for Office “Table view” (Shopify orders + POs). */

export type OfficeTableViewLinkedPo = {
  id: string;
  poNumber: string;
};

export type OfficeTableViewShopifyRow = {
  id: string;
  orderLabel: string;
  orderNumber: number;
  shopifyCreatedAt: string | null;
  displayFulfillmentStatus: string | null;
  displayFinancialStatus: string | null;
  archived: boolean;
  customerLabel: string;
  /** `https://bhfood.myshopify.com/admin/orders/{id}` or null if GID unparsable. */
  shopifyAdminOrderUrl: string | null;
  /** Count of synced Shopify order line items (for table + line preview). */
  lineItemCount: number;
  /** Linked POs (newest first) for table links / menu. */
  linkedPurchaseOrders: OfficeTableViewLinkedPo[];
};

/** Line item row for office table “preview” dialog (Shopify order tab). */
export type OfficeShopifyTableLineItem = {
  title: string | null;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  price: string | null;
  imageUrl: string | null;
  /** Frozen Shopify product vendor on the line. */
  shopifyVendor: string | null;
  /** Hub supplier company when `shopifyVendor` maps via ShopifyVendorMapping. */
  supplierCompany: string | null;
};

/** Line item row for office table “preview” dialog (PO tab). */
export type OfficePoTableLineItem = {
  sequence: number;
  productTitle: string | null;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  supplierRef: string | null;
  itemPrice: string | null;
};

export type OfficeTableViewPoRow = {
  id: string;
  poNumber: string;
  status: string;
  supplierCompany: string;
  createdAt: string;
  expectedDate: string | null;
  archived: boolean;
  lineItemCount: number;
  shopifyOrderCount: number;
};

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

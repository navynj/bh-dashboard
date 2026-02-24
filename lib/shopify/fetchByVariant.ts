import { createAdminApiClient } from '@shopify/admin-api-client';
import type { ShopifyConfig, ShopifyProduct } from '@/types/shopify';
import { calculateUnitPrice, calculateGPrice } from '@/lib/shopify/calculations';
import { processShopifyProduct } from '@/lib/shopify/productProcessor';

const PRODUCT_VARIANT_QUERY = `query Product($id: ID!) {
  productVariant(id: $id) {
    id
    price
    inventoryItem { unitCost { amount } }
    product {
      id
      handle
      title
      productType
      status
      vendor
      media(first:2) {
        nodes { preview { image { altText url } } }
      }
      options(first:3) { id name values position }
      metafield(namespace: "custom", key: "ingredient_information") { jsonValue }
    }
  }
}`;

/**
 * Fetches a single product by variant ID from Shopify and returns parsed data.
 * Used by cost itemEnhancement (server-side).
 */
export async function fetchShopifyProductByVariantId(
  shopifyConfig: ShopifyConfig,
  variantId: string
): Promise<{ products: ShopifyProduct[] }> {
  const client = createAdminApiClient({
    storeDomain: shopifyConfig.shopifyUrl,
    apiVersion: shopifyConfig.apiVersion,
    accessToken: shopifyConfig.adminToken,
  });

  const id = variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`;

  const { data, errors } = await client.request<{
    productVariant: {
      id: string;
      price: string;
      inventoryItem?: { unitCost?: { amount: string } };
      product: {
        id: string;
        handle: string;
        title: string;
        productType?: string;
        status: string;
        vendor?: string;
        media?: {
          nodes: Array<{
            preview?: { image?: { altText?: string; url: string } };
          }>;
        };
        metafield?: { jsonValue?: string[] };
      };
    };
  }>(PRODUCT_VARIANT_QUERY, { variables: { id } });

  const errList = Array.isArray(errors) ? errors : errors ? [errors] : [];
  if (errList.length > 0 || !data?.productVariant) {
    const msg = errList[0] && typeof errList[0] === 'object' && 'message' in errList[0]
      ? String((errList[0] as { message?: string }).message)
      : 'Product not found';
    throw new Error(msg || 'Product not found');
  }

  const variant = data.productVariant;
  const product = variant.product;
  if (!product) {
    return { products: [] };
  }

  const processed = await processShopifyProduct(
    {
      id: product.id,
      status: product.status || 'UNKNOWN',
      media: product.media,
      metafield: product.metafield,
    },
    client
  );

  const productVariant: ShopifyProduct = {
    ...processed,
    variantId: variant.id,
    price: +(variant.inventoryItem?.unitCost?.amount ?? variant.price ?? 0),
    title: product.title || 'Default Title',
  };
  productVariant.unitPrice = calculateUnitPrice(productVariant);
  productVariant.gPrice = calculateGPrice(productVariant);

  return { products: [productVariant] };
}
